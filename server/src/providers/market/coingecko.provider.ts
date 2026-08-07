import { fetchJson, ProviderError } from '../../lib/httpClient.js';
import { TtlCache } from '../../lib/cache.js';
import { logger } from '../../lib/logger.js';
import { findCoin } from '../../data/coins.js';
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

export class CoinGeckoProvider implements MarketDataProvider {
  readonly name = 'coingecko';

  private readonly cache = new TtlCache<CoinPrice[]>(CACHE_TTL_MS);

  constructor(
    private readonly baseUrl = process.env.COINGECKO_API_BASE ?? 'https://api.coingecko.com/api/v3',
  ) {}

  async getPrices(context: PersonalizationContext): Promise<ProviderResult<CoinPrice[]>> {
    const { coingeckoIds, selectedAssets, includeSparklines } = context;
    const cacheKey = `${coingeckoIds.join(',')}|${includeSparklines}`;
    const started = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { status: 'ok', data: cached, source: 'coingecko (cached)', fetchedAt: new Date().toISOString() };
    }

    const url =
      `${this.baseUrl}/coins/markets?vs_currency=usd` +
      `&ids=${encodeURIComponent(coingeckoIds.join(','))}` +
      `&sparkline=${includeSparklines}&price_change_percentage=24h`;

    try {
      const markets = await fetchJson<CoinGeckoMarket[]>(url, { timeoutMs: TIMEOUT_MS });
      const prices = this.toPrices(markets, selectedAssets, includeSparklines);

      this.cache.set(cacheKey, prices);
      logger.provider({ provider: this.name, outcome: 'ok', durationMs: Date.now() - started });

      return { status: 'ok', data: prices, source: 'coingecko', fetchedAt: new Date().toISOString() };
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : 'network_error';
      logger.provider({
        provider: this.name,
        outcome: kind === 'timeout' || kind === 'rate_limited' ? kind : 'http_error',
        durationMs: Date.now() - started,
        status: err instanceof ProviderError ? err.status : undefined,
      });

      // Expired data, labelled, beats an empty section. A 429 in particular is
      // never retried — the stale entry is the whole point of keeping it.
      const stale = this.cache.getStale(cacheKey);
      if (stale) {
        return {
          status: 'fallback',
          data: stale,
          source: 'coingecko (stale cache)',
          fetchedAt: new Date().toISOString(),
          notice:
            kind === 'rate_limited'
              ? 'CoinGecko is rate limiting us, so these prices are from the last successful update.'
              : 'Live prices are unavailable, so these are from the last successful update.',
        };
      }

      return {
        status: 'error',
        data: [],
        source: 'coingecko',
        fetchedAt: new Date().toISOString(),
        notice:
          kind === 'timeout'
            ? 'CoinGecko did not respond in time. Refresh to try again.'
            : kind === 'rate_limited'
              ? 'CoinGecko is rate limiting requests right now. Try again shortly.'
              : 'Prices could not be loaded right now. Refresh to try again.',
      };
    }
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
