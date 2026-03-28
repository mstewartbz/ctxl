import { Context, Next } from 'hono';
import type { Env } from '../types.js';
import { PLAN_LIMITS } from '../types.js';

// Simple in-memory rate limiter for development
// In production, this would use Cloudflare's Rate Limiting or a D1-backed counter
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute window

const RATE_LIMITS: Record<string, number> = {
  free: 60,      // 60 req/min
  indie: 200,    // 200 req/min
  pro: 600,      // 600 req/min
  scale: 2000,   // 2000 req/min
  enterprise: 10000,
};

export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const projectId = c.get('projectId') as string | undefined;
  const plan = (c.get('plan') as string) || 'free';
  
  // Skip rate limiting if no project context (public endpoints)
  if (!projectId) {
    return next();
  }
  
  const now = Date.now();
  const limit = RATE_LIMITS[plan] || RATE_LIMITS.free;
  const key = `${projectId}:${Math.floor(now / WINDOW_MS)}`;
  
  let entry = requestCounts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    requestCounts.set(key, entry);
  }
  
  entry.count++;
  
  // Set rate limit headers
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  
  if (entry.count > limit) {
    return c.json({
      error: 'Rate limit exceeded',
      message: `Plan ${plan} allows ${limit} requests per minute. Upgrade at https://ctxl.sh/pricing`,
      retry_after: Math.ceil((entry.resetAt - now) / 1000),
    }, 429);
  }
  
  // Cleanup old entries periodically
  if (requestCounts.size > 10000) {
    for (const [k, v] of requestCounts) {
      if (v.resetAt <= now) requestCounts.delete(k);
    }
  }
  
  await next();
}
