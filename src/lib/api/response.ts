import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ValidationError } from '@/lib/validation/schemas';

/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response formats across all API routes.
 */

// ============================================
// Response Types
// ============================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    count?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================
// Response Builders
// ============================================

/**
 * Create a success response
 */
export function success<T>(
  data: T,
  meta?: ApiSuccessResponse['meta']
): NextResponse<ApiSuccessResponse<T>> {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return NextResponse.json(response);
}

/**
 * Create an error response
 */
export function error(
  code: ErrorCode,
  message: string,
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };
  
  if (details !== undefined) {
    response.error.details = details;
  }
  
  return NextResponse.json(response, { status });
}

// ============================================
// Common Error Responses
// ============================================

export const errors = {
  badRequest: (message: string = 'Invalid request', details?: unknown) =>
    error(ErrorCodes.BAD_REQUEST, message, 400, details),
    
  validation: (message: string, validationErrors?: unknown) =>
    error(ErrorCodes.VALIDATION_ERROR, message, 400, validationErrors),
    
  unauthorized: (message: string = 'Authentication required') =>
    error(ErrorCodes.UNAUTHORIZED, message, 401),
    
  forbidden: (message: string = 'Access denied') =>
    error(ErrorCodes.FORBIDDEN, message, 403),
    
  notFound: (resource: string = 'Resource') =>
    error(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
    
  conflict: (message: string = 'Resource conflict') =>
    error(ErrorCodes.CONFLICT, message, 409),
    
  rateLimited: (retryAfter?: number) =>
    error(
      ErrorCodes.RATE_LIMITED, 
      'Too many requests. Please try again later.', 
      429,
      retryAfter ? { retryAfter } : undefined
    ),
    
  internal: (message: string = 'An unexpected error occurred') =>
    error(ErrorCodes.INTERNAL_ERROR, message, 500),
    
  serviceUnavailable: (service?: string) =>
    error(
      ErrorCodes.SERVICE_UNAVAILABLE, 
      service ? `${service} is currently unavailable` : 'Service temporarily unavailable', 
      503
    ),
    
  externalService: (service: string, details?: unknown) =>
    error(ErrorCodes.EXTERNAL_SERVICE_ERROR, `${service} error`, 502, details),
    
  database: (message: string = 'Database operation failed') =>
    error(ErrorCodes.DATABASE_ERROR, message, 500),
};

// ============================================
// Error Handler
// ============================================

/**
 * Handle errors and return appropriate response
 */
export function handleError(err: unknown): NextResponse<ApiErrorResponse> {
  console.error('API Error:', err);
  
  // Handle validation errors
  if (err instanceof ValidationError) {
    return errors.validation(err.message, err.errors);
  }
  
  // Handle Zod errors
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return errors.validation(messages.join('; '), err.errors);
  }
  
  // Handle standard errors
  if (err instanceof Error) {
    // Check for specific error types
    if (err.message.includes('not found') || err.message.includes('Not found')) {
      return errors.notFound();
    }
    
    if (err.message.includes('unauthorized') || err.message.includes('Unauthorized')) {
      return errors.unauthorized(err.message);
    }
    
    if (err.message.includes('rate limit') || err.message.includes('Rate limit')) {
      return errors.rateLimited();
    }
    
    // Generic error
    return errors.internal(
      process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'An unexpected error occurred'
    );
  }
  
  // Unknown error type
  return errors.internal();
}

// ============================================
// Pagination Helper
// ============================================

export interface PaginationMeta {
  total: number;
  count: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export function createPaginationMeta(
  total: number,
  count: number,
  offset: number,
  limit: number
): PaginationMeta {
  return {
    total,
    count,
    offset,
    limit,
    hasMore: offset + count < total,
  };
}

/**
 * Create a paginated success response
 */
export function paginatedSuccess<T>(
  items: T[],
  total: number,
  offset: number,
  limit: number
): NextResponse<ApiSuccessResponse<T[]>> {
  return success(items, createPaginationMeta(total, items.length, offset, limit));
}
