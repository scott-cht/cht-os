import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Shopify OAuth - Start Authorization
 * 
 * GET /api/shopify/auth
 * Redirects user to Shopify to authorize the app
 */
export async function GET(request: NextRequest) {
  const shop = process.env.SHOPIFY_STORE_DOMAIN;
  const apiKey = process.env.SHOPIFY_API_KEY;
  
  if (!shop || !apiKey) {
    return NextResponse.json(
      { error: 'SHOPIFY_STORE_DOMAIN or SHOPIFY_API_KEY not configured' },
      { status: 500 }
    );
  }

  // Build the OAuth URL manually
  const scopes = 'write_products,read_products,write_inventory,read_inventory';
  const redirectUri = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/shopify/auth/callback`;
  const state = crypto.randomBytes(16).toString('hex'); // CSRF protection
  
  // Store state in a cookie for verification in callback
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', apiKey);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  // Create response with redirect and state cookie
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
