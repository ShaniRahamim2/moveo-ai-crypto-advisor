import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinGeckoProvider } from '../src/providers/market/coingecko.provider.js';
import { LayeredNewsProvider } from '../src/providers/news/index.js';
import { StaticMemeProvider } from '../src/providers/meme/meme.provider.js';
import { RssNewsProvider } from '../src/providers/news/rss.provider.js';
import { buildPersonalizationContext } from '../src/services/personalization.js';
import { ProviderError } from '../src/lib/httpClient.js';

const hodler = buildPersonalizationContext({
  selectedAssets: ['BTC', 'ETH'],
  investorType: 'HODLER',
  contentPreferences: ['MARKET_NEWS', 'CHARTS'],
});

const trader = buildPersonalizationContext({
  selectedAssets: ['SOL', 'DOGE'],
  investorType: 'DAY_TRADER',
  contentPreferences: ['SOCIAL', 'FUN'],
});

function marketPayload(overrides: Partial<Record<string, unknown>>[] = []) {
  const base = [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      current_price: 64783,
      price_change_percentage_24h: -0.12,
      last_updated: '2026-08-07T12:00:00Z',
      sparkline_in_7d: { price: [1, 2, 3] },
    },
    {
      id: 'ethereum',
      symbol: 'eth',
      name: 'Ethereum',
      current_price: 1912.75,
      price_change_percentage_24h: 0.4,
      last_updated: '2026-08-07T12:00:00Z',
      sparkline_in_7d: { price: [4, 5, 6] },
    },
  ];
  return base.map((b, i) => ({ ...b, ...(overrides[i] ?? {}) }));
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CoinGeckoProvider', () => {
  it('returns prices in the order the user selected assets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(marketPayload().reverse())),
    );

    const result = await new CoinGeckoProvider().getPrices(hodler);

    expect(result.status).toBe('ok');
    expect(result.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(result.data[0]!.price).toBe(64783);
  });

  it('requests the assets the user actually chose', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await new CoinGeckoProvider().getPrices(trader);

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('solana');
    expect(url).toContain('dogecoin');
    expect(url).not.toContain('bitcoin');
  });

  it('includes sparklines only when Charts is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const withCharts = await new CoinGeckoProvider().getPrices(hodler);
    expect(withCharts.data[0]!.sparkline7d).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[0]![0]).toContain('sparkline=true');

    const noCharts = await new CoinGeckoProvider().getPrices(trader);
    expect(noCharts.data[0]?.sparkline7d).toBeUndefined();
  });

  it('handles HTTP 429 without throwing and without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new CoinGeckoProvider().getPrices(hodler);

    expect(result.status).toBe('error');
    expect(result.data).toEqual([]);
    expect(result.notice).toMatch(/rate limit/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves stale cache instead of failing when rate limited', async () => {
    const provider = new CoinGeckoProvider();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(marketPayload())));
    const first = await provider.getPrices(hodler);
    expect(first.status).toBe('ok');

    // Expire the cache window, then rate limit the refresh.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const second = await provider.getPrices(hodler);

    expect(second.status).toBe('fallback');
    expect(second.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(second.source).toMatch(/stale/i);
    expect(second.notice).toMatch(/rate limiting/i);
  });

  it('aborts on timeout and returns a degraded response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
      ),
    );

    const result = await new CoinGeckoProvider().getPrices(hodler);

    expect(result.status).toBe('error');
    expect(result.notice).toMatch(/did not respond in time/i);
  }, 10_000);

  it('serves the cache without a second network call inside the TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new CoinGeckoProvider();
    await provider.getPrices(hodler);
    const second = await provider.getPrices(hodler);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.source).toMatch(/cached/i);
  });
});

describe('LayeredNewsProvider', () => {
  const rssXml = `<rss><channel>
    <item><title>Bitcoin ETF inflows continue</title><link>https://example.com/a</link><pubDate>${new Date().toUTCString()}</pubDate></item>
    <item><title>Ethereum upgrade ships</title><link>https://example.com/b</link><pubDate>${new Date().toUTCString()}</pubDate></item>
    <item><title>Solana tooling expands</title><link>https://example.com/c</link><pubDate>${new Date().toUTCString()}</pubDate></item>
  </channel></rss>`;

  function stubRss() {
    return {
      ok: true,
      status: 200,
      text: () => Promise.resolve(rssXml),
      json: () => Promise.resolve({}),
    } as unknown as Response;
  }

  it('falls through to RSS when CryptoPanic fails', async () => {
    const cryptoPanic = {
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockRejectedValue(new ProviderError('http_error', 'Upstream returned 404', 404)),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stubRss()));

    const provider = new LayeredNewsProvider(cryptoPanic as never);
    const result = await provider.getNews(hodler);

    expect(cryptoPanic.getNews).toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.source).toMatch(/Cointelegraph/);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('uses CryptoPanic when it works, keeping the social signal', async () => {
    const cryptoPanic = {
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockResolvedValue([
        {
          title: 'Bitcoin holds steady',
          url: 'https://example.com/cp1',
          source: 'CryptoPanic',
          publishedAt: new Date().toISOString(),
          assets: ['BTC'],
          socialScore: 44,
        },
      ]),
    };

    const result = await new LayeredNewsProvider(cryptoPanic as never).getNews(hodler);

    expect(result.status).toBe('ok');
    expect(result.source).toBe('CryptoPanic');
    expect(result.data[0]!.socialScore).toBe(44);
  });

  it('falls all the way to labelled sample content when every live tier fails', async () => {
    const cryptoPanic = {
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockRejectedValue(new ProviderError('timeout', 'timed out')),
    };
    const rss = { name: 'rss', getNews: vi.fn().mockRejectedValue(new Error('all feeds down')) };

    const result = await new LayeredNewsProvider(cryptoPanic as never, rss as never).getNews(hodler);

    expect(result.status).toBe('fallback');
    expect(result.source).toBe('Sample content');
    expect(result.notice).toMatch(/sample content/i);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('does not call CryptoPanic when no token is configured', async () => {
    const cryptoPanic = { name: 'cryptopanic', configured: false, getNews: vi.fn() };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stubRss()));

    await new LayeredNewsProvider(cryptoPanic as never).getNews(hodler);

    expect(cryptoPanic.getNews).not.toHaveBeenCalled();
  });

  it('deduplicates by URL and drops items older than 72 hours', async () => {
    const stale = new Date(Date.now() - 100 * 3600_000).toISOString();
    const cryptoPanic = {
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockResolvedValue([
        { title: 'A', url: 'https://example.com/x', source: 's', publishedAt: new Date().toISOString(), assets: ['BTC'] },
        { title: 'A duplicate', url: 'https://example.com/x', source: 's', publishedAt: new Date().toISOString(), assets: ['BTC'] },
        { title: 'Ancient', url: 'https://example.com/old', source: 's', publishedAt: stale, assets: ['BTC'] },
      ]),
    };

    const result = await new LayeredNewsProvider(cryptoPanic as never).getNews(hodler);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.url).toBe('https://example.com/x');
  });

  it('applies the social signal only when the Social preference is set', async () => {
    const items = [
      { title: 'Low signal BTC', url: 'https://example.com/low', source: 's', publishedAt: new Date().toISOString(), assets: ['SOL'], socialScore: 1 },
      { title: 'High signal BTC', url: 'https://example.com/high', source: 's', publishedAt: new Date().toISOString(), assets: ['SOL'], socialScore: 900 },
    ];
    const make = () => ({
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockResolvedValue(items),
    });

    const withSocial = await new LayeredNewsProvider(make() as never).getNews(trader);
    expect(withSocial.data[0]!.url).toBe('https://example.com/high');

    const hodlerOnSol = buildPersonalizationContext({
      selectedAssets: ['SOL'],
      investorType: 'HODLER',
      contentPreferences: ['MARKET_NEWS'],
    });
    const withoutSocial = await new LayeredNewsProvider(make() as never).getNews(hodlerOnSol);
    expect(withoutSocial.data.map((i) => i.url)).toContain('https://example.com/low');
  });
});

describe('StaticMemeProvider', () => {
  it('returns a meme', async () => {
    const result = await new StaticMemeProvider().getMeme();

    expect(result.status).toBe('ok');
    expect(result.data.caption).toBeTruthy();
    expect(result.data.altText).toBeTruthy();
  });

  it('never repeats the meme just shown', async () => {
    const provider = new StaticMemeProvider();
    let previous = (await provider.getMeme()).data.id;

    for (let i = 0; i < 40; i++) {
      const next = (await provider.getMeme(previous)).data.id;
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('still returns something when only one meme exists', async () => {
    const only = [
      { id: 'solo', caption: 'a', subcaption: 'b', accent: '#fff', altText: 'alt' },
    ];
    const result = await new StaticMemeProvider(only).getMeme('solo');

    expect(result.status).toBe('ok');
    expect(result.data.id).toBe('solo');
  });
});

describe('RSS asset detection', () => {
  function feedWith(title: string) {
    return {
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          `<rss><channel><item><title>${title}</title><link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`,
        ),
      json: () => Promise.resolve({}),
    } as unknown as Response;
  }

  async function assetsFor(title: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feedWith(title)));
    const items = await new RssNewsProvider([{ name: 'Test', url: 'https://example.com/rss' }]).getNews();
    return items[0]!.assets;
  }

  it('tags uppercase tickers', async () => {
    expect(await assetsFor('Hackers move 64 BTC and 200 ETH to a mixer')).toEqual(
      expect.arrayContaining(['BTC', 'ETH']),
    );
  });

  it('tags coin names case-insensitively', async () => {
    expect(await assetsFor('MARA sold almost all its mined bitcoin')).toContain('BTC');
  });

  it('does not tag NEAR from the phrase "near-zero"', async () => {
    const assets = await assetsFor("Why Bitcoin's BIP-110 refuses to die despite near-zero support");
    expect(assets).toContain('BTC');
    expect(assets).not.toContain('NEAR');
  });

  it('does not tag ONE from the word "one"', async () => {
    expect(await assetsFor('Only one exchange reported an outage today')).not.toContain('ONE');
  });
});
