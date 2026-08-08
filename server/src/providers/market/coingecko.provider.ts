import { fetchJson, ProviderError } from '../../lib/httpClient.js';
import { TtlCache } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { findCoin } from '../../data/coins.js';
import {
  priceSnapshotStore,
  type PriceSnapshotStore,
} from '../../services/priceSnapshot.store.js';
import type { PersonalizationContext } from '../../services/personalization.js';
import type { CoinPrice, MarketDataProvider, ProviderResult } from '../types.js';

const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 90_000;

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  last_updated: string;
  image?: string;
  sparkline_in_7d?: { price: number[] };
}

function describeAge(fetchedAt: Date): string {
  const minutes = Math.round((Date.now() - fetchedAt.getTime()) / 60_000);
  if (minutes < 1) return 'less than a minute ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export class CoinGeckoProvider implements MarketDataProvider {
  readonly name = 'coingecko';

  private readonly cache = new TtlCache<CoinPrice[]>(CACHE_TTL_MS);

  constructor(
    private readonly baseUrl = process.env.COINGECKO_API_BASE ?? 'https://api.coingecko.com/api/v3',
    private readonly apiKey = process.env.COINGECKO_API_KEY ?? '',
    private readonly snapshots: PriceSnapshotStore = priceSnapshotStore,
  ) {}

  /**
   * Keyless CoinGecko requests are rate limited per IP and that quota is shared
   * with every other caller on the same IP. On shared hosting that pool is
   * routinely exhausted, so the deployed backend was receiving 429 on every
   * call while the same request from a residential IP succeeded. A Demo key
   * moves the quota onto the key itself.
   */
  private get headers(): Record<string, string> {
    return this.apiKey ? { 'x-cg-demo-api-key': this.apiKey } : {};
  }

  async getPrices(context: PersonalizationContext): Promise<ProviderResult<CoinPrice[]>> {
    const { coingeckoIds, selectedAssets, includeSparklines } = context;
    const cacheKey = `${coingeckoIds.join(',')}|${includeSparklines}`;
    const started = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        status: 'ok',
        data: cached,
        source: 'coingecko (cached)',
        fetchedAt: new Date().toISOString(),
      };
    }

    const url =
      `${this.baseUrl}/coins/markets?vs_currency=usd` +
      `&ids=${encodeURIComponent(coingeckoIds.join(','))}` +
      `&sparkline=${includeSparklines}&price_change_percentage=24h`;

    try {
      const markets = await fetchJson<CoinGeckoMarket[]>(url, {
        timeoutMs: TIMEOUT_MS,
        headers: this.headers,
      });
      const prices = this.toPrices(markets, selectedAssets, includeSparklines);

      if (prices.length === 0) {
        throw new ProviderError('parse_error', 'Upstream returned no matching coins');
      }

      this.cache.set(cacheKey, prices);
      void this.snapshots.write(cacheKey, prices);
      logger.provider({ provider: this.name, outcome: 'ok', durationMs: Date.now() - started });

      return {
        status: 'ok',
        data: prices,
        source: 'coingecko',
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : 'network_error';
      logger.provider({
        provider: this.name,
        outcome: kind === 'timeout' || kind === 'rate_limited' ? kind : 'http_error',
        durationMs: Date.now() - started,
        status: err instanceof ProviderError ? err.status : undefined,
      });

      return this.degrade(cacheKey, kind);
    }
  }

  /**
   * In-process cache first, then the persisted snapshot. The second tier is what
   * makes this reachable at all on a cold start — the first has nothing in it
   * until a call has already succeeded in this process.
   */
  private async degrade(
    cacheKey: string,
    kind: string,
  ): Promise<ProviderResult<CoinPrice[]>> {
    const reason =
      kind === 'rate_limited'
        ? 'CoinGecko is rate limiting us'
        : kind === 'timeout'
          ? 'CoinGecko did not respond in time'
          : 'Live prices are unavailable';

    const stale = this.cache.getStale(cacheKey);
    if (stale) {
      return {
        status: 'fallback',
        data: stale,
        source: 'coingecko (recent)',
        fetchedAt: new Date().toISOString(),
        notice: `${reason}, so these prices are from the last successful update.`,
      };
    }

    const snapshot = await this.snapshots.read(cacheKey);
    if (snapshot && snapshot.prices.length > 0) {
      return {
        status: 'fallback',
        data: snapshot.prices,
        source: 'coingecko (saved)',
        fetchedAt: snapshot.fetchedAt.toISOString(),
        notice: `${reason}, so these prices were last updated ${describeAge(snapshot.fetchedAt)}.`,
      };
    }

    return {
      status: 'error',
      data: [],
      source: 'coingecko',
      fetchedAt: new Date().toISOString(),
      notice:
        kind === 'rate_limited'
          ? 'CoinGecko is rate limiting requests right now. Try again shortly.'
          : kind === 'timeout'
            ? 'CoinGecko did not respond in time. Refresh to try again.'
            : 'Prices could not be loaded right now. Refresh to try again.',
    };
  }

  // Returned in the order the user picked their assets, not CoinGecko's order.
  private toPrices(
    markets: CoinGeckoMarket[],
    selectedAssets: string[],
    includeSparklines: boolean,
  ): CoinPrice[] {
    const byId = new Map(markets.map((m) => [m.id, m]));

    return selectedAssets
      .map((symbol) => {
        const coin = findCoin(symbol);
        const market = coin ? byId.get(coin.coingeckoId) : undefined;
        if (!coin || !market) return null;

        const price: CoinPrice = {
          symbol: coin.symbol,
          name: coin.name,
          price: market.current_price,
          change24hPercent: market.price_change_percentage_24h ?? 0,
          lastUpdated: market.last_updated,
          ...(market.image ? { imageUrl: market.image } : {}),
        };

        if (includeSparklines && market.sparkline_in_7d?.price?.length) {
          price.sparkline7d = market.sparkline_in_7d.price;
        }

        return price;
      })
      .filter((p): p is CoinPrice => p !== null);
  }
}
