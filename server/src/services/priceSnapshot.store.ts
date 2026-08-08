import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { CoinPrice } from '../providers/types.js';

export interface PriceSnapshot {
  prices: CoinPrice[];
  fetchedAt: Date;
}

export interface PriceSnapshotStore {
  read(cacheKey: string): Promise<PriceSnapshot | null>;
  write(cacheKey: string, prices: CoinPrice[]): Promise<void>;
}

/**
 * Survives process restarts, which the in-memory cache cannot. Render's free
 * tier sleeps after 15 minutes idle, so without this every cold start begins
 * with nothing to fall back on if the upstream is unavailable.
 *
 * Every method swallows its own errors: a cache is an optimisation, and a
 * failing one must never take the prices section down with it.
 */
export const priceSnapshotStore: PriceSnapshotStore = {
  async read(cacheKey) {
    try {
      const row = await prisma.priceSnapshot.findUnique({ where: { cacheKey } });
      if (!row) return null;

      return { prices: row.payload as unknown as CoinPrice[], fetchedAt: row.fetchedAt };
    } catch {
      logger.warn('price_snapshot_read_failed');
      return null;
    }
  },

  async write(cacheKey, prices) {
    try {
      const payload = prices as unknown as Prisma.InputJsonValue;
      await prisma.priceSnapshot.upsert({
        where: { cacheKey },
        update: { payload, fetchedAt: new Date() },
        create: { cacheKey, payload },
      });
    } catch {
      logger.warn('price_snapshot_write_failed');
    }
  },
};
