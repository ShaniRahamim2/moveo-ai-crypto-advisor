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

  // Render terminates TLS at its own proxy and forwards the caller in
  // X-Forwarded-For. Without this, req.ip is the proxy for every request and the
  // rate limiters below would throttle all users as a single client. One hop,
  // not `true`: trusting the whole chain would let a caller spoof the header and
  // hand themselves a fresh bucket per request.
  app.set('trust proxy', 1);

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
