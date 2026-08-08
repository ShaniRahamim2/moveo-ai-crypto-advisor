import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { ProviderError } from '../lib/httpClient.js';
import { OpenRouterProvider } from '../providers/ai/openrouter.provider.js';
import { buildFallbackInsight, clampInsight, parseInsightResponse } from '../providers/ai/prompt.js';
import type { AIProvider, InsightInput } from '../providers/ai/types.js';
import type { PersonalizationContext } from './personalization.js';
import type { CoinPrice, NewsItem, ProviderResult } from '../providers/types.js';

export const DISCLAIMER =
  'AI-generated insight for informational purposes only. Not financial advice.';

export interface Insight {
  /** One sentence for the collapsed view. Null when the model gave no usable summary. */
  summary: string | null;
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

/**
 * Cached rows written before the summary existed hold plain text rather than
 * JSON. Those still have to render, so anything unparseable is treated as a
 * full insight with no summary.
 */
function parseStoredInsight(stored: string): { summary: string | null; text: string } {
  try {
    const parsed = JSON.parse(stored) as { summary?: unknown; text?: unknown };
    if (typeof parsed.text === 'string' && parsed.text.trim()) {
      return {
        summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : null,
        text: parsed.text,
      };
    }
  } catch {
    // Falls through to the legacy plain-text shape.
  }
  return { summary: null, text: stored };
}

export class InsightService {
  constructor(
    private readonly provider: AIProvider & { configured?: boolean } = new OpenRouterProvider(),
  ) {}

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
        source: 'AI-generated · cached today',
        fetchedAt: new Date().toISOString(),
      };
    }

    const started = Date.now();
    try {
      if (this.provider.configured === false) {
        throw new ProviderError('http_error', 'AI provider is not configured');
      }

      const raw = await this.provider.generateInsight(input);
      const parsed = parseInsightResponse(raw);
      const insight: Insight = {
        summary: parsed.summary,
        text: clampInsight(parsed.insight),
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
        source: 'AI-generated',
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
          summary: null,
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

      const stored = parseStoredInsight(row.insightText);

      return {
        summary: stored.summary,
        // Clamped on read as well as on write, so a row cached before the cap
        // existed cannot render an over-long insight.
        text: clampInsight(stored.text),
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
          insightText: JSON.stringify({ summary: insight.summary, text: insight.text }),
          model: insight.model ?? null,
        },
      });
    } catch {
      logger.warn('insight_cache_write_failed');
    }
  }
}
