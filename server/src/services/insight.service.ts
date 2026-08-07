import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ProviderError } from '../lib/httpClient.js';
import { OpenRouterProvider } from '../providers/ai/openrouter.provider.js';
import { buildFallbackInsight } from '../providers/ai/prompt.js';
import type { AIProvider, InsightInput } from '../providers/ai/types.js';
import type { PersonalizationContext } from './personalization.js';
import type { CoinPrice, NewsItem, ProviderResult } from '../providers/types.js';

export const DISCLAIMER =
  'AI-generated insight for informational purposes only. Not financial advice.';

export interface Insight {
  text: string;
  disclaimer: string;
  generatedAt: string;
  /** Absent when the text was assembled without a model. */
  model?: string;
  aiGenerated: boolean;
}

/**
 * Free-tier OpenRouter allows roughly 50 requests a day, which a reviewer
 * clicking around could exhaust. The insight is therefore generated once per
 * personalization context per day and reused. Prices are deliberately excluded
 * from the hash: including them would defeat the cache, since they move
 * constantly.
 */
export function buildContextHash(
  context: PersonalizationContext,
  today = new Date().toISOString().slice(0, 10),
): string {
  const material = JSON.stringify({
    assets: [...context.selectedAssets].sort(),
    investorType: context.investorType,
    contentPreferences: [...context.contentPreferences].sort(),
    date: today,
  });

  return createHash('sha256').update(material).digest('hex');
}

export class InsightService {
  constructor(private readonly provider: AIProvider & { configured?: boolean } = new OpenRouterProvider()) {}

  async getInsight(
    context: PersonalizationContext,
    prices: CoinPrice[],
    news: NewsItem[],
  ): Promise<ProviderResult<Insight>> {
    const contextHash = buildContextHash(context);

    const input: InsightInput = {
      assets: context.aiContext.assets,
      investorType: context.aiContext.investorType,
      framing: context.aiContext.framing,
      contentFocus: context.aiContext.contentFocus,
      prices: prices.map((p) => ({
        symbol: p.symbol,
        price: p.price,
        change24hPercent: p.change24hPercent,
      })),
      headlines: news.slice(0, 5).map((n) => ({ title: n.title, source: n.source })),
    };

    const cached = await this.readCache(contextHash);
    if (cached) {
      return {
        status: 'ok',
        data: cached,
        source: `${cached.model ?? 'cache'} (cached today)`,
        fetchedAt: new Date().toISOString(),
      };
    }

    const started = Date.now();
    try {
      if (this.provider.configured === false) {
        throw new ProviderError('http_error', 'AI provider is not configured');
      }

      const text = await this.provider.generateInsight(input);
      const insight: Insight = {
        text,
        disclaimer: DISCLAIMER,
        generatedAt: new Date().toISOString(),
        model: this.provider.model,
        aiGenerated: true,
      };

      await this.writeCache(contextHash, insight);
      logger.provider({
        provider: `ai:${this.provider.name}`,
        outcome: 'ok',
        durationMs: Date.now() - started,
      });

      return {
        status: 'ok',
        data: insight,
        source: this.provider.model,
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : 'network_error';
      logger.provider({
        provider: `ai:${this.provider.name}`,
        outcome: kind === 'timeout' || kind === 'rate_limited' ? kind : 'http_error',
        durationMs: Date.now() - started,
        detail: (err as Error).message.slice(0, 120),
      });

      // Never cached: a fallback should not occupy the day's slot and block a
      // real insight on the next refresh.
      return {
        status: 'fallback',
        data: {
          text: buildFallbackInsight(input),
          disclaimer: DISCLAIMER,
          generatedAt: new Date().toISOString(),
          aiGenerated: false,
        },
        source: 'market data summary',
        fetchedAt: new Date().toISOString(),
        notice:
          kind === 'rate_limited'
            ? 'The AI model is rate limited right now, so this summary was assembled from the market data without AI.'
            : 'The AI model is unavailable right now, so this summary was assembled from the market data without AI.',
      };
    }
  }

  private async readCache(contextHash: string): Promise<Insight | null> {
    try {
      const row = await prisma.insightCache.findUnique({ where: { contextHash } });
      if (!row) return null;

      return {
        text: row.insightText,
        disclaimer: DISCLAIMER,
        generatedAt: row.generatedAt.toISOString(),
        ...(row.model ? { model: row.model } : {}),
        aiGenerated: true,
      };
    } catch {
      // A cache read failure must not take the section down.
      logger.warn('insight_cache_read_failed');
      return null;
    }
  }

  private async writeCache(contextHash: string, insight: Insight): Promise<void> {
    try {
      await prisma.insightCache.create({
        data: {
          contextHash,
          insightText: insight.text,
          model: insight.model ?? null,
        },
      });
    } catch {
      logger.warn('insight_cache_write_failed');
    }
  }
}
