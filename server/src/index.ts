import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { logger } from './lib/logger.js';

/**
 * Neon's free tier suspends the compute after a period of inactivity, and the
 * first connection to a suspended instance can fail outright rather than wait
 * for it to wake. The reviewer's first action is signing in, so the connection
 * is opened at boot with a couple of retries instead of letting that failure
 * land on a login request.
 */
async function warmDatabase(attempts = 3): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      logger.warn('database_warmup_retry', {
        attempt,
        detail: (err as Error).message.split('\n')[0]?.slice(0, 120),
      });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      }
    }
  }

  // The server still starts: /api/health reports the database separately, and a
  // later request may well succeed once the instance has woken.
  logger.error('database_warmup_failed');
}

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
  void warmDatabase();
});
