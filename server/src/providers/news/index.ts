import { TtlCache } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { ProviderError } from '../../lib/httpClient.js';
import type { PersonalizationContext } from '../../services/personalization.js';
import type { NewsItem, NewsProvider, ProviderResult } from '../types.js';
import { CryptoPanicProvider } from './cryptopanic.provider.js';
import { RssNewsProvider } from './rss.provider.js';
import { getStaticNews } from './static.news.js';

const CACHE_TTL_MS = 120_000;
const MAX_ITEMS = 6;
const MAX_AGE_HOURS = 72;

interface Tier {
  name: string;
  label: string;
  status: 'ok' | 'fallback';
  notice?: string;
  fetch: (context: PersonalizationContext) => Promise<NewsItem[]>;
}

/**
 * Tries each source in order and reports which one actually served. Ordering is
 * deliberate: CryptoPanic first because it is the only tier carrying a community
 * signal, live RSS second, curated sample content only as a last resort.
 */
export class LayeredNewsProvider implements NewsProvider {
  readonly name = 'news';

  private readonly cache = new TtlCache<ProviderResult<NewsItem[]>>(CACHE_TTL_MS);

  constructor(
    private readonly cryptoPanic = new CryptoPanicProvider(),
    private readonly rss = new RssNewsProvider(),
  ) {}

  private get tiers(): Tier[] {
    const tiers: Tier[] = [];

    if (this.cryptoPanic.configured) {
      tiers.push({
        name: 'cryptopanic',
        label: 'CryptoPanic',
        status: 'ok',
        fetch: (context) => this.cryptoPanic.getNews(context),
      });
    }

    tiers.push({
      name: 'rss',
      label: 'Cointelegraph, Decrypt, CoinDesk, CryptoSlate',
      status: 'ok',
      fetch: () => this.rss.getNews(),
    });

    tiers.push({
      name: 'static',
      label: 'Sample content',
      status: 'fallback',
      notice:
        'Live news sources are unavailable right now, so this is sample content rather than current headlines.',
      fetch: () => Promise.resolve(getStaticNews()),
    });

    return tiers;
  }

  async getNews(context: PersonalizationContext): Promise<ProviderResult<NewsItem[]>> {
    const cacheKey = `${context.selectedAssets.join(',')}|${context.weightNewsBySocialSignal}`;

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, source: `${cached.source} (cached)` };
    }

    for (const tier of this.tiers) {
      const started = Date.now();
      try {
        const raw = await tier.fetch(context);
        const items = this.rank(raw, context);

        if (items.length === 0) {
          throw new Error('Tier returned no usable items');
        }

        logger.provider({
          provider: `news:${tier.name}`,
          outcome: tier.status === 'ok' ? 'ok' : 'fallback',
          durationMs: Date.now() - started,
        });

        const result: ProviderResult<NewsItem[]> = {
          status: tier.status,
          data: items,
          source: tier.label,
          fetchedAt: new Date().toISOString(),
          ...(tier.notice ? { notice: tier.notice } : {}),
        };

        this.cache.set(cacheKey, result);
        return result;
      } catch (err) {
        const kind = err instanceof ProviderError ? err.kind : 'network_error';
        logger.provider({
          provider: `news:${tier.name}`,
          outcome: kind === 'timeout' || kind === 'rate_limited' ? kind : 'http_error',
          durationMs: Date.now() - started,
          status: err instanceof ProviderError ? err.status : undefined,
          detail: (err as Error).message.slice(0, 120),
        });
      }
    }

    return {
      status: 'error',
      data: [],
      source: 'none',
      fetchedAt: new Date().toISOString(),
      notice: 'News could not be loaded right now. Refresh to try again.',
    };
  }

  /**
   * Deduplicate by URL, drop anything stale, prefer items mentioning the user's
   * assets, and only then apply the social weighting when the tier supplied a
   * signal. Sources without one are never given a fabricated score.
   */
  private rank(items: NewsItem[], context: PersonalizationContext): NewsItem[] {
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
    const selected = new Set(context.selectedAssets);
    const seen = new Set<string>();

    const fresh = items.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return new Date(item.publishedAt).getTime() >= cutoff;
    });

    const scored = fresh.map((item) => {
      const matches = item.assets.filter((a) => selected.has(a)).length;
      let score = matches * 100;

      if (context.weightNewsBySocialSignal && typeof item.socialScore === 'number') {
        score += item.socialScore;
      }

      score += Math.max(0, 48 - (Date.now() - new Date(item.publishedAt).getTime()) / 3600_000);
      return { item, score, matches };
    });

    const relevant = scored.filter((s) => s.matches > 0);
    const pool = relevant.length >= 3 ? relevant : scored;

    return pool
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ITEMS)
      .map((s) => s.item);
  }
}
