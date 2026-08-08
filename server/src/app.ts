import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Three hops sit in front of the app in production — Cloudflare's edge and two
  // inside Render — so X-Forwarded-For arrives as `<client>, <cloudflare>,
  // <render>`. The count was measured against the deployed service rather than
  // assumed: at one hop req.ip resolved to Render's internal 10.x address, which
  // would have keyed every user in the world into a single rate-limit bucket.
  //
  // A fixed count rather than `true` is what makes this spoof-resistant: a forged
  // X-Forwarded-For is prepended to the chain, so counting from the right steps
  // straight past it. Verified by sending one.
  app.set('trust proxy', 3);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
