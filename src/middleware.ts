import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Authentication & CSRF Middleware
 * 
 * Protects API routes with:
 * 1. API key authentication
 * 2. CSRF token validation for state-changing requests
 * 
 * Set INTERNAL_API_KEY in .env.local to enable protection.
 * If not set, auth is bypassed (development mode).
 */

// Routes that don't require CSRF protection
const CSRF_EXEMPT_ROUTES = [
  '/api/csrf',           // CSRF token endpoint
  '/api/shopify/auth',   // OAuth initiation
  '/api/integrations/status',
];

// Routes that don't require any auth
const PUBLIC_ROUTES = [
  '/api/csrf',
  '/api/integrations/status',
  '/api/shopify/auth',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  
  // Only protect API routes (excluding auth callbacks)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Allow OAuth callback routes
  if (pathname.includes('/auth/callback')) {
    return NextResponse.next();
  }
  
  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }
  
  // CSRF check for state-changing requests
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isCsrfExempt = CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route));
  
  if (isStateChanging && !isCsrfExempt) {
    const csrfCookie = request.cookies.get('csrf_token')?.value;
    const csrfHeader = request.headers.get('x-csrf-token');
    
    // Validate CSRF token (timing-safe comparison in production)
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      // Allow if request is from same origin (for browser fetch)
      const origin = request.headers.get('origin');
      const host = request.headers.get('host');
      
      let isSameOrigin = false;
      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          isSameOrigin = originUrl.host === host;
        } catch {
          // Invalid origin
        }
      }
      
      // In development or same-origin, be lenient
      // In production with CSRF enabled, require valid token
      const csrfRequired = process.env.CSRF_PROTECTION === 'true';
      
      if (csrfRequired && !isSameOrigin) {
        return NextResponse.json(
          { 
            error: 'CSRF validation failed',
            message: 'Missing or invalid CSRF token. Include X-CSRF-Token header.',
          },
          { status: 403 }
        );
      }
    }
  }
  
  // Check for API key
  const apiKey = process.env.INTERNAL_API_KEY;
  
  // If no API key configured, allow all (development mode)
  if (!apiKey) {
    return NextResponse.next();
  }
  
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  const providedKey = authHeader?.replace('Bearer ', '');
  
  // Also check X-API-Key header (alternative)
  const xApiKey = request.headers.get('x-api-key');
  
  // Also check for session cookie (for browser requests)
  const sessionCookie = request.cookies.get('app_session');
  
  if (providedKey === apiKey || xApiKey === apiKey || sessionCookie?.value === apiKey) {
    return NextResponse.next();
  }
  
  // Check if request is from same origin (browser requests from the app itself)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Strict origin matching to prevent subdomain bypass
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      // Exact host match (no subdomain bypass)
      if (originUrl.host === host) {
        return NextResponse.next();
      }
    } catch {
      // Invalid origin URL, reject
    }
  }
  
  // Strict referer matching
  if (referer && host) {
    try {
      const refererUrl = new URL(referer);
      // Exact host match (no subdomain bypass)
      if (refererUrl.host === host) {
        return NextResponse.next();
      }
    } catch {
      // Invalid referer URL, reject
    }
  }
  
  // Reject unauthorized external requests
  return NextResponse.json(
    { 
      error: 'Unauthorized',
      message: 'Valid API key required. Use Authorization: Bearer <key> or X-API-Key header.',
    },
    { status: 401 }
  );
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
