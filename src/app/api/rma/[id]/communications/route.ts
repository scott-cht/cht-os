import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import {
  rmaCommunicationCreateSchema,
  validateBody,
  ValidationError,
} from '@/lib/validation/schemas';
import { renderRmaTemplate, toMailtoUrl } from '@/lib/rma/communications';
import type { RmaCase } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('rma_customer_communications')
      .select('*')
      .eq('rma_case_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('rma_customer_communications')) {
        return NextResponse.json(
          { error: 'Communication log table not found. Apply migration 019_rma_communications.sql.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ communications: data || [] });
  } catch (error) {
    console.error('RMA communications list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list communications' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.inventory, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const body = validateBody(rmaCommunicationCreateSchema, await request.json());
    const supabase = createServerClient();

    const { data: rmaCase, error: rmaCaseError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (rmaCaseError || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }

    const caseData = rmaCase as RmaCase;
    const template = body.template_key
      ? renderRmaTemplate({
          templateKey: body.template_key,
          rmaCase: caseData,
        })
      : null;

    const subject = body.subject || template?.subject || 'RMA update';
    const message = body.body || template?.body || '';
    if (!message.trim()) {
      return NextResponse.json({ error: 'Email body is required' }, { status: 400 });
    }
    const recipient = body.recipient || caseData.customer_email || '';
    if (!recipient) {
      return NextResponse.json(
        { error: 'Recipient email is required. Set customer email or provide recipient.' },
        { status: 400 }
      );
    }

    const mailtoUrl = body.send_mode === 'manual_mailto'
      ? toMailtoUrl({ recipient, subject, body: message })
      : null;

    const payload = {
      rma_case_id: id,
      channel: 'email',
      direction: 'outbound',
      template_key: body.template_key || null,
      recipient,
      subject,
      body: message,
      status: body.send_mode === 'manual_mailto' ? 'opened_in_mail_client' : 'logged',
      metadata: {
        ...body.metadata,
        send_mode: body.send_mode,
      },
    };

    const { data: created, error: insertError } = await supabase
      .from('rma_customer_communications')
      .insert(payload)
      .select('*')
      .single();

    if (insertError || !created) {
      if (insertError?.message.includes('relation') && insertError?.message.includes('rma_customer_communications')) {
        return NextResponse.json(
          { error: 'Communication log table not found. Apply migration 019_rma_communications.sql.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError?.message || 'Failed to log communication' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      communication: created,
      mailto_url: mailtoUrl,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message, validationErrors: error.errors },
        { status: 400 }
      );
    }
    console.error('RMA communications create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create communication entry' },
      { status: 500 }
    );
  }
}
