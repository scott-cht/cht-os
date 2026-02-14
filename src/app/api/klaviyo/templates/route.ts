import { NextResponse } from 'next/server';
import { listTemplates, isKlaviyoConfigured } from '@/lib/klaviyo/client';
import { errors } from '@/lib/api/response';

/**
 * GET /api/klaviyo/templates
 * List Klaviyo templates for style guide selection
 */
export async function GET() {
  if (!isKlaviyoConfigured()) {
    return errors.serviceUnavailable('Klaviyo');
  }
  try {
    const templates = await listTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Klaviyo listTemplates error:', error);
    return errors.externalService('Klaviyo', error instanceof Error ? error.message : 'Failed to list templates');
  }
}
