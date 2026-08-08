import rateLimit, { type Options } from 'express-rate-limit';
import { ApiError } from '../lib/apiError.js';
import { env } from '../config/env.js';

/**
 * Keyed on req.ip, which behind Render resolves to the real caller only because
 * `trust proxy` is set in createApp. Without it every request keys to Render's
 * internal address and one noisy client throttles everybody, so the two settings
 * have to move together.
 *
 * `skip` is a parameter rather than a hard NODE_ENV check so the middleware can
 * be exercised by its own test. The shared limiters below stand down under test:
 * the suite fires hundreds of requests from one address, and a live limiter would
 * make failures depend on test ordering rather than on behaviour.
 */
export function createLimiter(
  windowMs: number,
  limit: number,
  message: string,
  skip: () => boolean = () => env.NODE_ENV === 'test',
) {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip,
    handler: (_req, _res, next) => {
      next(new ApiError(429, 'RATE_LIMITED', message));
    },
  };

  return rateLimit(options);
}

// Password guessing and account enumeration are the attacks worth throttling
// hardest, and a real person does not sign in ten times in a quarter of an hour.
export const authLimiter = createLimiter(
  15 * 60 * 1000,
  10,
  'Too many attempts. Wait a few minutes and try again.',
);

// Every dashboard build can reach CoinGecko and OpenRouter, whose free tiers are
// small enough that one client in a loop exhausts them for every user — which has
// already happened once in production. This is a quota guard, so it sits well
// above what interactive use produces.
export const dashboardLimiter = createLimiter(
  60 * 1000,
  30,
  'You are refreshing very quickly. Wait a moment and try again.',
);

export const apiLimiter = createLimiter(
  60 * 1000,
  120,
  'Too many requests. Wait a moment and try again.',
);
