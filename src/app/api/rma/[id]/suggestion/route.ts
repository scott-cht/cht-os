import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimiters } from '@/lib/utils/rate-limiter';
import { config } from '@/config';

const RECOMMENDATION_PROMPT = `You are a post-sales service analyst for a premium Australian home theatre retailer.
You will receive an RMA case plus serial service history.
Return ONLY JSON:
{
  "recommendation": "repair" | "replace" | "monitor",
  "confidence": 0-1,
  "rationale": "short explanation focused on customer trust and reliability risk"
}

Guidance:
- Recommend "replace" when repeat failures suggest recurring defect pattern.
- Recommend "repair" for isolated/low-frequency service issues.
- Recommend "monitor" when data is sparse or inconclusive.
- Keep rationale under 500 characters.`;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * POST /api/rma/[id]/suggestion
 * Generate AI recommendation (repair vs replace) from service history.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIp = request.headers.get('x-forwarded-for') || 'anonymous';
  const rateCheck = checkRateLimit(rateLimiters.anthropic, clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data: rmaCase, error: rmaError } = await supabase
      .from('rma_cases')
      .select('*')
      .eq('id', id)
      .single();
    if (rmaError || !rmaCase) {
      return NextResponse.json({ error: 'RMA case not found' }, { status: 404 });
    }
    if (!rmaCase.serial_number) {
      return NextResponse.json(
        { error: 'RMA case has no serial number for recommendation' },
        { status: 400 }
      );
    }

    const { data: registry } = await supabase
      .from('serial_registry')
      .select('*')
      .eq('serial_number', rmaCase.serial_number)
      .maybeSingle();

    const { data: events } = registry
      ? await supabase
          .from('serial_service_events')
          .select('event_type, summary, notes, metadata, created_at')
          .eq('serial_registry_id', registry.id)
          .order('created_at', { ascending: false })
          .limit(50)
      : { data: [] };

    const historyPayload = {
      rmaCase: {
        id: rmaCase.id,
        status: rmaCase.status,
        serial_number: rmaCase.serial_number,
        issue_summary: rmaCase.issue_summary,
        issue_details: rmaCase.issue_details,
        arrival_condition_report: rmaCase.arrival_condition_report,
      },
      registry: registry
        ? {
            rma_count: registry.rma_count,
            last_rma_at: registry.last_rma_at,
            first_seen_at: registry.first_seen_at,
          }
        : null,
      events: events || [],
    };

    const response = await getAnthropicClient().messages.create({
      model: config.ai.model,
      max_tokens: 600,
      temperature: 0.2,
      system: RECOMMENDATION_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this service history and recommend repair/replace/monitor:\n${JSON.stringify(historyPayload)}`,
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('AI response missing text');
    }

    let raw = textBlock.text.trim();
    if (raw.includes('```')) {
      raw = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    }
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      raw = match[0];
    }

    const parsed = JSON.parse(raw) as {
      recommendation?: 'repair' | 'replace' | 'monitor';
      confidence?: number;
      rationale?: string;
    };

    const recommendation = {
      recommendation: parsed.recommendation || 'monitor',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      rationale: parsed.rationale || 'Insufficient history details; monitor further service outcomes.',
      generatedAt: new Date().toISOString(),
    };

    await supabase
      .from('rma_cases')
      .update({ ai_recommendation: recommendation })
      .eq('id', rmaCase.id);

    return NextResponse.json({ success: true, recommendation });
  } catch (error) {
    console.error('RMA suggestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate recommendation' },
      { status: 500 }
    );
  }
}
