import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateCsrfToken, getCsrfCookieOptions } from '@/lib/security/csrf';

/**
 * CSRF Token Endpoint
 * 
 * GET /api/csrf - Get or create CSRF token
 * 
 * The token is set in an HttpOnly cookie and also returned in the response
 * for client-side usage in fetch requests.
 */

export async function GET() {
  const cookieStore = await cookies();
  let token = cookieStore.get('csrf_token')?.value;
  
  // Generate new token if none exists
  if (!token) {
    token = generateCsrfToken();
  }
  
  // Create response with token
  const response = NextResponse.json({ token });
  
  // Set/refresh the cookie
  response.cookies.set('csrf_token', token, getCsrfCookieOptions());
  
  return response;
}
