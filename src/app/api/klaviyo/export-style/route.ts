import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getTemplate, getCampaignMessage, getTemplateForCampaignMessage, isKlaviyoConfigured } from '@/lib/klaviyo/client';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import { validateBody, ValidationError } from '@/lib/validation/schemas';
import { klaviyoExportStyleSchema } from '@/lib/validation/schemas';
import { errors } from '@/lib/api/response';
import type { ExportedStyleSample } from '@/types/klaviyo';

/**
 * POST /api/klaviyo/export-style
 * Fetch template/campaign message content from Klaviyo and optionally save as style guides
 */
export async function POST(request: NextRequest) {
  if (!isKlaviyoConfigured()) {
    return errors.serviceUnavailable('Klaviyo');
  }
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.klaviyo, clientIp);
  if (!rateCheck.allowed) {
    return errors.rateLimited(rateCheck.retryAfter);
  }
  try {
    const raw = await request.json();
    const body = validateBody(klaviyoExportStyleSchema, raw);
    const saveToDb = body.saveToDb ?? true;

    const results: (ExportedStyleSample & { savedId?: string })[] = [];

    if (body.templateIds?.length) {
      for (const id of body.templateIds) {
        const t = await getTemplate(id);
        const sample: ExportedStyleSample = {
          id,
          name: t.name,
          subject: null,
          html: t.html ?? '',
          plainText: t.plain_text ?? null,
        };
        let savedId: string | undefined;
        if (saveToDb) {
          const supabase = createServerClient();
          const { data: row, error: insertError } = await supabase
            .from('email_style_guides')
            .insert({
              name: t.name,
              subject: null,
              html: t.html ?? '',
              plain_text: t.plain_text ?? null,
              source_type: 'template',
              source_id: id,
            })
            .select('id')
            .single();
          if (!insertError && row) savedId = row.id;
        }
        results.push({ ...sample, savedId });
      }
    }

    if (body.campaignMessageIds?.length) {
      for (const { campaignId, messageId } of body.campaignMessageIds) {
        const msg = await getCampaignMessage(campaignId, messageId);
        let html = '';
        let plainText: string | null = null;
        try {
          const t = await getTemplateForCampaignMessage(messageId);
          html = t.html ?? '';
          plainText = t.plain_text ?? null;
        } catch (templateErr) {
          console.warn(`Could not load template for campaign message ${messageId}:`, templateErr);
        }
        const sample: ExportedStyleSample = {
          id: messageId,
          name: msg.subject ?? `Campaign message ${messageId}`,
          subject: msg.subject ?? null,
          html,
          plainText,
        };
        let savedId: string | undefined;
        if (saveToDb) {
          const supabase = createServerClient();
          const { data: row, error: insertError } = await supabase
            .from('email_style_guides')
            .insert({
              name: sample.name,
              subject: msg.subject ?? null,
              html: sample.html,
              plain_text: plainText,
              source_type: 'campaign_message',
              source_id: `${campaignId}:${messageId}`,
            })
            .select('id')
            .single();
          if (!insertError && row) savedId = row.id;
        }
        results.push({ ...sample, savedId });
      }
    }

    return NextResponse.json({ samples: results });
  } catch (err) {
    if (err instanceof ValidationError) {
      return errors.validation(err.message, err.errors);
    }
    const message = err instanceof Error ? err.message : 'Export failed';
    console.error('Klaviyo export-style error:', message);
    return NextResponse.json(
      { success: false, error: { code: 'EXTERNAL_SERVICE_ERROR', message } },
      { status: 502 }
    );
  }
}
