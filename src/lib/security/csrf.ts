import { cookies } from 'next/headers';
import crypto from 'crypto';

/**
 * CSRF Protection Utilities
 * 
 * Implements double-submit cookie pattern for CSRF protection.
 * The token is stored in an HttpOnly cookie and must be sent
 * in the X-CSRF-Token header for state-changing requests.
 */

const CSRF_COOKIE_NAME = 'csrf_token';
const TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * Get or create CSRF token (for server components/API routes)
 */
export async function getOrCreateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (existingToken) {
    return existingToken;
  }
  
  // Generate new token
  const newToken = generateCsrfToken();
  
  // Set cookie - will be done by the response
  return newToken;
}

/**
 * Validate CSRF token from request
 */
export function validateCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(headerToken)
    );
  } catch {
    return false;
  }
}

/**
 * Get CSRF cookie options
 */
export function getCsrfCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  };
}

/**
 * CSRF token response for client-side usage
 */
export interface CsrfResponse {
  token: string;
}
