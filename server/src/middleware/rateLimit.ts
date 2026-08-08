import rateLimit, { type Options } from 'express-rate-limit';
import { ApiError } from '../lib/apiError.js';
import { env } from '../config/env.js';

/**
 * Keyed on req.ip, which behind Render resolves to the real client only because
 * `trust proxy` is set in createApp. Without it every request keys to Render's
 * proxy and one noisy client throttles everybody, so the two settings have to
 * move together.
 *
 * Disabled under NODE_ENV=test: the suite fires hundreds of requests from one
 * address, and a limiter would make failures depend on test ordering.
 */
function limiter(windowMs: number, max: number, message: string) {
  const options: Partial<Options> = {
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, _res, next) => {
      next(new ApiError(429, 'RATE_LIMITED', message));
    },
  };

  return rateLimit(options);
}

// Password guessing and account enumeration are the attacks worth throttling
// hardest, and a legitimate person does not sign in ten times in a quarter hour.
export const authLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Too many attempts. Wait a few minutes and try again.',
);

// Every dashboard build can reach CoinGecko and OpenRouter, whose free tiers are
// small enough that one client in a loop can exhaust them for every user — which
// has already happened once in production. This is a quota guard, so it sits
// well above what interactive use produces.
export const dashboardLimiter = limiter(
  60 * 1000,
  30,
  'You are refreshing very quickly. Wait a moment and try again.',
);

export const apiLimiter = limiter(
  60 * 1000,
  120,
  'Too many requests. Wait a moment and try again.',
);
