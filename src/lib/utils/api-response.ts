import { NextResponse } from 'next/server';

/**
 * Standardized API Response Format
 * 
 * All API routes should use these helpers to ensure consistent responses.
 */

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Create a successful API response
 */
export function apiSuccess<T>(
  data: T,
  options: {
    status?: number;
    meta?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): NextResponse<ApiResponse<T>> {
  const { status = 200, meta = {}, headers = {} } = options;
  
  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status, headers }
  );
}

/**
 * Create an error API response
 */
export function apiError(
  code: string,
  message: string,
  options: {
    status?: number;
    details?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextResponse<ApiErrorResponse> {
  const { status = 500, details, headers = {} } = options;
  
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers }
  );
}

// Common error responses
export const ApiErrors = {
  badRequest: (message: string, details?: unknown) =>
    apiError('BAD_REQUEST', message, { status: 400, details }),
  
  unauthorized: (message = 'Authentication required') =>
    apiError('UNAUTHORIZED', message, { status: 401 }),
  
  forbidden: (message = 'Access denied') =>
    apiError('FORBIDDEN', message, { status: 403 }),
  
  notFound: (resource = 'Resource') =>
    apiError('NOT_FOUND', `${resource} not found`, { status: 404 }),
  
  rateLimited: (retryAfter?: number) =>
    apiError('RATE_LIMITED', 'Too many requests. Please try again later.', {
      status: 429,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : {},
    }),
  
  serverError: (message = 'Internal server error', details?: unknown) =>
    apiError('SERVER_ERROR', message, { status: 500, details }),
  
  serviceUnavailable: (service: string) =>
    apiError('SERVICE_UNAVAILABLE', `${service} is temporarily unavailable`, { status: 503 }),
};

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((error) => {
    console.error('API Error:', error);
    return ApiErrors.serverError(
      error instanceof Error ? error.message : 'Unknown error'
    );
  });
}
