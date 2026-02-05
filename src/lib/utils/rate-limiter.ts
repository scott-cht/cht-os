/**
 * Simple in-memory rate limiter for API routes
 * 
 * Usage:
 *   const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
 *   if (!limiter.tryAcquire(identifier)) {
 *     return { error: 'Rate limited', retryAfter: limiter.getRetryAfter(identifier) };
 *   }
 */

interface RateLimiterOptions {
  /** Maximum requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private requests: Map<string, RequestRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * Try to acquire a request slot
   * @returns true if request is allowed, false if rate limited
   */
  tryAcquire(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now >= record.resetAt) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (record.count < this.maxRequests) {
      record.count++;
      return true;
    }

    return false;
  }

  /**
   * Get seconds until the rate limit resets
   */
  getRetryAfter(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record) return 0;
    return Math.max(0, Math.ceil((record.resetAt - Date.now()) / 1000));
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const record = this.requests.get(identifier);
    
    if (!record || now >= record.resetAt) {
      return this.maxRequests;
    }
    
    return Math.max(0, this.maxRequests - record.count);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now >= record.resetAt) {
        this.requests.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters for different services
export const rateLimiters = {
  // Anthropic API: 60 requests per minute (conservative)
  anthropic: new RateLimiter({ maxRequests: 50, windowMs: 60000 }),
  
  // SerpAPI: 100 searches per month, so be very conservative
  serpapi: new RateLimiter({ maxRequests: 5, windowMs: 60000 }),
  
  // Shopify API: 2 requests per second bucket
  shopify: new RateLimiter({ maxRequests: 100, windowMs: 60000 }),
  
  // HubSpot API: 100 requests per 10 seconds
  hubspot: new RateLimiter({ maxRequests: 80, windowMs: 10000 }),
  
  // Notion API: 3 requests per second
  notion: new RateLimiter({ maxRequests: 150, windowMs: 60000 }),
  
  // General scraping: Be polite to target sites
  scraping: new RateLimiter({ maxRequests: 10, windowMs: 60000 }),
};

/**
 * Helper to check rate limit and return appropriate response
 */
export function checkRateLimit(
  limiter: RateLimiter,
  identifier: string
): { allowed: boolean; retryAfter?: number; remaining: number } {
  const allowed = limiter.tryAcquire(identifier);
  return {
    allowed,
    retryAfter: allowed ? undefined : limiter.getRetryAfter(identifier),
    remaining: limiter.getRemaining(identifier),
  };
}

export { RateLimiter };
export type { RateLimiterOptions };
