import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerClient } from '@/lib/supabase/server';

/**
 * Shopify OAuth - Callback Handler
 * 
 * GET /api/shopify/auth/callback
 * Handles the OAuth callback from Shopify and stores the access token
 */
export async function GET(request: NextRequest) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  
  if (!shop || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Shopify credentials not configured' },
      { status: 500 }
    );
  }

  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  try {
    // Get query parameters from Shopify
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const hmac = request.nextUrl.searchParams.get('hmac');
    
    if (!code) {
      throw new Error('No authorization code received');
    }
    
    // Verify state (CSRF protection)
    const storedState = request.cookies.get('shopify_oauth_state')?.value;
    if (state !== storedState) {
      throw new Error('State mismatch - possible CSRF attack');
    }
    
    // Verify HMAC
    const queryParams = new URLSearchParams(request.nextUrl.search);
    queryParams.delete('hmac');
    queryParams.sort();
    const message = queryParams.toString();
    const generatedHmac = crypto
      .createHmac('sha256', apiSecret)
      .update(message)
      .digest('hex');
    
    if (hmac !== generatedHmac) {
      throw new Error('HMAC validation failed');
    }
    
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;
    
    if (!accessToken) {
      throw new Error('No access token in response');
    }

    // Store the token in Supabase
    const supabase = createServerClient();
    
    const { error: upsertError } = await supabase
      .from('oauth_tokens')
      .upsert({
        provider: 'shopify',
        shop: shop,
        access_token: accessToken,
        scope: scope,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'provider,shop',
      });

    if (upsertError) {
      console.error('Failed to store token:', upsertError);
    }

    // Clear the state cookie and redirect to dashboard
    const response = NextResponse.redirect(`${baseUrl}/?shopify_auth=success`);
    response.cookies.delete('shopify_oauth_state');
    return response;
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(`${baseUrl}/?shopify_auth=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
}
