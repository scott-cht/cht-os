import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createTemplate,
  createCampaign,
  assignTemplateToCampaignMessage,
  updateCampaignMessage,
  isKlaviyoConfigured,
  getMissingKlaviyoSenderConfig,
} from '@/lib/klaviyo/client';
import { validateBody, ValidationError } from '@/lib/validation/schemas';
import { klaviyoPushSchema } from '@/lib/validation/schemas';
import { errors } from '@/lib/api/response';
import { rateLimiters, checkRateLimit } from '@/lib/utils/rate-limiter';
import {
  acquireIdempotency,
  buildRequestHash,
  finalizeIdempotency,
  idempotencyReplayResponse,
} from '@/lib/api/idempotency';

const idempotencySupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/klaviyo/push
 * Create a Klaviyo template from generated email and optionally create a draft campaign
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

  let idempotencyRecordId: string | null = null;

  try {
    const raw = await request.json();
    const body = validateBody(klaviyoPushSchema, raw);

    const idempotencyKey =
      request.headers.get('idempotency-key') || request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const idempotencyResult = await acquireIdempotency(idempotencySupabase, {
        endpoint: '/api/klaviyo/push',
        idempotencyKey,
        requestHash: buildRequestHash(body),
      });

      if (idempotencyResult.type === 'conflict') {
        return errors.conflict('Idempotency key reused with different request body');
      }
      if (idempotencyResult.type === 'in_progress') {
        return errors.conflict('A request with this idempotency key is already in progress');
      }
      if (idempotencyResult.type === 'replay') {
        return idempotencyReplayResponse(
          idempotencyResult.statusCode,
          idempotencyResult.responseBody
        );
      }
      idempotencyRecordId = idempotencyResult.recordId;
    }

    const respond = async (response: NextResponse, failed: boolean = false) => {
      if (idempotencyRecordId) {
        let payload: unknown = null;
        try {
          payload = await response.clone().json();
        } catch {
          payload = null;
        }
        await finalizeIdempotency(idempotencySupabase, {
          recordId: idempotencyRecordId,
          statusCode: response.status,
          responseBody: payload,
          failed,
        });
      }
      return response;
    };

    if (body.createCampaign) {
      const missingSenderConfig = getMissingKlaviyoSenderConfig();
      if (missingSenderConfig.length > 0) {
        return respond(
          errors.badRequest(
            `Campaign creation requires sender config: ${missingSenderConfig.join(', ')}`
          ),
          true
        );
      }
    }

    const templateName = body.campaignName ?? body.subject.slice(0, 100);
    const { id: templateId } = await createTemplate({
      name: templateName,
      html: body.htmlBody,
      editorType: 'CODE',
      plainText: body.plainText ?? undefined,
    });

    let campaignId: string | undefined;
    let messageId: string | undefined;

    if (body.createCampaign) {
      const created = await createCampaign({
        name: body.campaignName ?? body.subject,
        subject: body.subject,
        previewText: body.preheader ?? undefined,
      });
      campaignId = created.campaignId;
      messageId = created.messageId;
      if (messageId) {
        await assignTemplateToCampaignMessage(messageId, templateId);
        await updateCampaignMessage(messageId, {
          subject: body.subject,
          preview_text: body.preheader ?? undefined,
        });
      }
    }

    return respond(NextResponse.json({
      templateId,
      campaignId: campaignId ?? null,
      messageId: messageId ?? null,
      message: body.createCampaign
        ? 'Template and draft campaign created in Klaviyo.'
        : 'Template created in Klaviyo. Attach it to a campaign in the Klaviyo dashboard.',
    }));
  } catch (err) {
    let response: NextResponse;
    if (err instanceof ValidationError) {
      response = errors.validation(err.message, err.errors);
    } else {
      console.error('Klaviyo push error:', err);
      response = errors.externalService(
        'Klaviyo',
        err instanceof Error ? err.message : 'Push to Klaviyo failed'
      );
    }
    if (idempotencyRecordId) {
      let payload: unknown = null;
      try {
        payload = await response.clone().json();
      } catch {
        payload = null;
      }
      await finalizeIdempotency(idempotencySupabase, {
        recordId: idempotencyRecordId,
        statusCode: response.status,
        responseBody: payload,
        failed: true,
      });
    }
    return response;
  }
}
