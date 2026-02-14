import { NextRequest, NextResponse } from 'next/server';
import { listCampaigns, isKlaviyoConfigured } from '@/lib/klaviyo/client';
import { errors } from '@/lib/api/response';

/**
 * GET /api/klaviyo/campaigns?channel=email
 * List Klaviyo campaigns (default email) for style guide selection
 */
export async function GET(request: NextRequest) {
  if (!isKlaviyoConfigured()) {
    return errors.serviceUnavailable('Klaviyo');
  }
  try {
    const channel = (request.nextUrl.searchParams.get('channel') || 'email') as 'email' | 'sms' | 'mobile_push';
    const campaigns = await listCampaigns(channel);
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Klaviyo listCampaigns error:', error);
    return errors.externalService('Klaviyo', error instanceof Error ? error.message : 'Failed to list campaigns');
  }
}
