import { TtlCache } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { ProviderError } from '../../lib/httpClient.js';
import type { PersonalizationContext } from '../../services/personalization.js';
import type { NewsItem, NewsProvider, ProviderResult } from '../types.js';
import { CryptoPanicProvider } from './cryptopanic.provider.js';
import { RssNewsProvider } from './rss.provider.js';
import { getStaticNews } from './static.news.js';
import { isSafeHttpUrl } from './url.js';

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

    // Each headline carries its own publication, so the section label only needs
    // to say which tier served — a full source list overflows the card header.
    tiers.push({
      name: 'rss',
      label: 'Live RSS',
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
      return cached;
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
   * Deduplicate by URL, drop anything stale, then pick for *coverage* rather
   * than volume.
   *
   * Crypto RSS skews heavily to Bitcoin, so a straight relevance sort gives a
   * user with five assets five Bitcoin headlines and reads as personalization
   * only half working. Selection therefore goes round-robin: every selected
   * asset gets one article before any asset gets a second.
   *
   * An asset with no genuine match is skipped, never padded. Partial coverage of
   * real matches beats full coverage of forced ones, and stretching a tag to fit
   * would be inventing relevance.
   */
  private rank(items: NewsItem[], context: PersonalizationContext): NewsItem[] {
    const cutoff = Date.now() - MAX_AGE_HOURS * 3600_000;
    const seen = new Set<string>();

    const fresh = items.filter((item) => {
      if (!item.url || !isSafeHttpUrl(item.url) || seen.has(item.url)) return false;
      seen.add(item.url);
      return new Date(item.publishedAt).getTime() >= cutoff;
    });

    const score = (item: NewsItem) => {
      const social =
        context.weightNewsBySocialSignal && typeof item.socialScore === 'number'
          ? item.socialScore
          : 0;
      const recency = Math.max(
        0,
        48 - (Date.now() - new Date(item.publishedAt).getTime()) / 3600_000,
      );
      return social + recency;
    };

    // One queue per selected asset, best first.
    const queues = new Map<string, NewsItem[]>();
    for (const asset of context.selectedAssets) {
      const matches = fresh
        .filter((item) => item.assets.includes(asset))
        .sort((a, b) => score(b) - score(a));
      if (matches.length > 0) queues.set(asset, matches);
    }

    const picked: NewsItem[] = [];
    const takenUrls = new Set<string>();

    // Round-robin: a second article for an asset only after every other asset
    // with matches has had its first.
    while (picked.length < MAX_ITEMS && queues.size > 0) {
      let progressed = false;

      for (const [asset, queue] of [...queues]) {
        if (picked.length >= MAX_ITEMS) break;

        const next = queue.find((item) => !takenUrls.has(item.url));
        if (!next) {
          queues.delete(asset);
          continue;
        }

        picked.push(next);
        takenUrls.add(next.url);
        progressed = true;
      }

      if (!progressed) break;
    }

    // Only once every selected asset has been served does general crypto news
    // fill any remaining slots.
    if (picked.length < MAX_ITEMS) {
      const rest = fresh
        .filter((item) => !takenUrls.has(item.url))
        .sort((a, b) => score(b) - score(a));

      for (const item of rest) {
        if (picked.length >= MAX_ITEMS) break;
        picked.push(item);
      }
    }

    return picked;
  }
}
