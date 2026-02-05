import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Integration Status endpoint
 * Returns configuration status for all integrations
 * 
 * GET /api/integrations/status
 */
export async function GET() {
  // Check Shopify configuration
  // First check env var, then check for OAuth token in database
  let shopifyConfigured = !!(
    process.env.SHOPIFY_STORE_DOMAIN &&
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  );
  
  // Check for OAuth token if no static token
  if (!shopifyConfigured && process.env.SHOPIFY_STORE_DOMAIN) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data } = await supabase
        .from('oauth_tokens')
        .select('access_token')
        .eq('provider', 'shopify')
        .eq('shop', process.env.SHOPIFY_STORE_DOMAIN)
        .single();
      
      shopifyConfigured = !!data?.access_token;
    } catch {
      // Table might not exist yet, that's ok
    }
  }
  
  // Check if Shopify needs auth (has config but no token)
  const shopifyNeedsAuth = !!(
    process.env.SHOPIFY_STORE_DOMAIN &&
    process.env.SHOPIFY_API_KEY &&
    process.env.SHOPIFY_API_SECRET &&
    !shopifyConfigured
  );

  // Check HubSpot configuration (either access token OR client credentials)
  const hubspotConfigured = !!(
    (process.env.HUBSPOT_ACCESS_TOKEN && process.env.HUBSPOT_ACCESS_TOKEN.startsWith('pat-')) ||
    (process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET)
  );

  // Check Notion configuration
  const notionConfigured = !!(
    process.env.NOTION_API_KEY &&
    process.env.NOTION_INVENTORY_DATABASE_ID
  );

  return NextResponse.json({
    shopify: {
      configured: shopifyConfigured,
      needsAuth: shopifyNeedsAuth,
      status: shopifyConfigured ? 'ready' : shopifyNeedsAuth ? 'needs_auth' : 'not_configured',
    },
    hubspot: {
      configured: hubspotConfigured,
      status: hubspotConfigured ? 'ready' : 'not_configured',
    },
    notion: {
      configured: notionConfigured,
      status: notionConfigured ? 'ready' : 'not_configured',
    },
  });
}
