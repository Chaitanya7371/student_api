import type { Request, RequestHandler } from 'express';
import { tooManyRequests } from '../errors/AppError.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** Builds the bucket key. Prefer req.user.id over IP for school networks. */
  keyFn: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Simple in-memory rate limiter. Fine for one process; not shared across servers.
 */
export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    const key = options.keyFn(req);
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      next(tooManyRequests('Too many requests, try again later'));
      return;
    }

    existing.count += 1;
    next();
  };
}
