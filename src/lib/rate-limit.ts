import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter factory.
 * Uses Upstash Redis when env vars are set, falls back to in-memory for dev.
 */

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }
  return null;
}

// Agent API rate limiter: 60 req/min sliding window
let agentLimiter: Ratelimit | null = null;

export function getAgentRateLimiter(): Ratelimit | null {
  if (agentLimiter) return agentLimiter;
  const r = getRedis();
  if (!r) return null; // fallback to in-memory
  agentLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'openpod:agent',
  });
  return agentLimiter;
}

// Registration rate limiter: 5 per hour per IP
let registrationLimiter: Ratelimit | null = null;

export function getRegistrationRateLimiter(): Ratelimit | null {
  if (registrationLimiter) return registrationLimiter;
  const r = getRedis();
  if (!r) return null;
  registrationLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(5, '3600 s'),
    prefix: 'openpod:register',
  });
  return registrationLimiter;
}
