import { NextRequest, NextResponse } from 'next/server';
import { getCampaignMessages, isKlaviyoConfigured } from '@/lib/klaviyo/client';
import { errors } from '@/lib/api/response';

/**
 * GET /api/klaviyo/campaigns/[id]/messages
 * List campaign message IDs for a campaign (for style guide export)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isKlaviyoConfigured()) {
    return errors.serviceUnavailable('Klaviyo');
  }
  try {
    const { id: campaignId } = await params;
    const messages = await getCampaignMessages(campaignId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Klaviyo getCampaignMessages error:', error);
    return errors.externalService('Klaviyo', error instanceof Error ? error.message : 'Failed to list campaign messages');
  }
}
