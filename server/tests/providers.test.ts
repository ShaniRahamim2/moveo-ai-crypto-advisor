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

const noSnapshots = () => ({
  read: vi.fn().mockResolvedValue(null),
  write: vi.fn().mockResolvedValue(undefined),
});

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

    const result = await new CoinGeckoProvider(undefined, '', noSnapshots()).getPrices(hodler);

    expect(result.status).toBe('ok');
    expect(result.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(result.data[0]!.price).toBe(64783);
  });

  it('requests the assets the user actually chose', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await new CoinGeckoProvider(undefined, '', noSnapshots()).getPrices(trader);

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain('solana');
    expect(url).toContain('dogecoin');
    expect(url).not.toContain('bitcoin');
  });

  it('includes sparklines only when Charts is selected', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new CoinGeckoProvider(undefined, '', noSnapshots());
    const withCharts = await provider.getPrices(hodler);
    expect(withCharts.data[0]!.sparkline7d).toEqual([1, 2, 3]);
    expect(fetchMock.mock.calls[0]![0]).toContain('sparkline=true');

    const noCharts = await new CoinGeckoProvider(undefined, '', noSnapshots()).getPrices(trader);
    expect(noCharts.data[0]?.sparkline7d).toBeUndefined();
  });

  it('handles HTTP 429 without throwing and without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new CoinGeckoProvider(undefined, '', noSnapshots()).getPrices(hodler);

    expect(result.status).toBe('error');
    expect(result.data).toEqual([]);
    expect(result.notice).toMatch(/rate limit/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves stale cache instead of failing when rate limited', async () => {
    const provider = new CoinGeckoProvider(undefined, '', noSnapshots());

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(marketPayload())));
    const first = await provider.getPrices(hodler);
    expect(first.status).toBe('ok');

    // Expire the cache window, then rate limit the refresh.
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const second = await provider.getPrices(hodler);

    expect(second.status).toBe('fallback');
    expect(second.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(second.source).toMatch(/recent/i);
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

    const result = await new CoinGeckoProvider(undefined, '', noSnapshots()).getPrices(hodler);

    expect(result.status).toBe('error');
    expect(result.notice).toMatch(/did not respond in time/i);
  }, 10_000);

  it('serves the cache without a second network call inside the TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new CoinGeckoProvider(undefined, '', noSnapshots());
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
    expect(result.source).toBe('Live RSS feeds');
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
  it('returns a meme and the browsable deck', async () => {
    const result = await new StaticMemeProvider().getMeme();

    expect(result.status).toBe('ok');
    expect(result.data.current.caption).toBeTruthy();
    expect(result.data.current.altText).toBeTruthy();
    expect(result.data.deck.length).toBeGreaterThanOrEqual(10);
    expect(result.data.deck.map((m) => m.id)).toContain(result.data.current.id);
  });

  it('never repeats the meme just shown', async () => {
    const provider = new StaticMemeProvider();
    let previous = (await provider.getMeme()).data.current.id;

    for (let i = 0; i < 40; i++) {
      const next = (await provider.getMeme(previous)).data.current.id;
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('still returns something when only one meme exists', async () => {
    const only = [
      { id: 'solo', imageUrl: '/memes/solo.svg', caption: 'a', subcaption: 'b', altText: 'alt' },
    ];
    const result = await new StaticMemeProvider(only).getMeme('solo');

    expect(result.status).toBe('ok');
    expect(result.data.current.id).toBe('solo');
  });

  it('excludes hidden memes from the deck', async () => {
    const provider = new StaticMemeProvider();
    const all = (await provider.getMeme()).data.deck.map((m) => m.id);
    const hidden = new Set(all.slice(0, 3));

    const result = await provider.getMeme(undefined, hidden);

    expect(result.data.deck.map((m) => m.id)).not.toEqual(expect.arrayContaining([...hidden]));
    expect(hidden.has(result.data.current.id)).toBe(false);
    expect(result.data.hiddenCount).toBe(3);
    expect(result.data.exhausted).toBe(false);
  });

  it('shows everything again, flagged, once every meme is hidden', async () => {
    const provider = new StaticMemeProvider();
    const all = (await provider.getMeme()).data.deck.map((m) => m.id);

    const result = await provider.getMeme(undefined, new Set(all));

    expect(result.status).toBe('ok');
    expect(result.data.exhausted).toBe(true);
    expect(result.data.deck.length).toBe(all.length);
    expect(result.notice).toMatch(/hidden every meme/i);
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

describe('meme manifest', () => {
  it('loads every entry from the JSON manifest', async () => {
    const { MEMES } = await import('../src/providers/meme/memes.js');

    expect(MEMES.length).toBeGreaterThanOrEqual(10);
    for (const meme of MEMES) {
      expect(meme.imageUrl).toMatch(/^\/memes\/.+\.(svg|png|jpg|jpeg|gif|webp)$/i);
      expect(meme.altText.length).toBeGreaterThan(10);
      expect(meme.caption).toBeTruthy();
    }
  });

  it('has unique ids and unique image paths', async () => {
    const { MEMES } = await import('../src/providers/meme/memes.js');

    expect(new Set(MEMES.map((m) => m.id)).size).toBe(MEMES.length);
    expect(new Set(MEMES.map((m) => m.imageUrl)).size).toBe(MEMES.length);
  });
});

describe('meme images on disk', () => {
  // Guards the hand-edited workflow: adding a manifest row but forgetting the
  // file, or mistyping the filename, would render a broken image in production.
  it('has a real file in client/public for every manifest entry', async () => {
    const { existsSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const { MEMES } = await import('../src/providers/meme/memes.js');

    const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'public');
    const missing = MEMES.filter((m) => !existsSync(join(publicDir, m.imageUrl))).map(
      (m) => `${m.id} -> ${m.imageUrl}`,
    );

    expect(missing).toEqual([]);
  });
});

describe('CoinGecko API key and persisted snapshots', () => {
  const emptyStore = { read: vi.fn().mockResolvedValue(null), write: vi.fn().mockResolvedValue(undefined) };

  it('sends the demo key header when a key is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await new CoinGeckoProvider(undefined, 'CG-test-key', emptyStore).getPrices(hodler);

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-cg-demo-api-key']).toBe('CG-test-key');
  });

  it('omits the header entirely when no key is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await new CoinGeckoProvider(undefined, '', emptyStore).getPrices(hodler);

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.headers as Record<string, string>).not.toHaveProperty('x-cg-demo-api-key');
  });

  it('never puts the key in the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(marketPayload()));
    vi.stubGlobal('fetch', fetchMock);

    await new CoinGeckoProvider(undefined, 'CG-test-key', emptyStore).getPrices(hodler);

    expect(fetchMock.mock.calls[0]![0] as string).not.toContain('CG-test-key');
  });

  it('persists a snapshot after a successful fetch', async () => {
    const store = { read: vi.fn().mockResolvedValue(null), write: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(marketPayload())));

    await new CoinGeckoProvider(undefined, '', store).getPrices(hodler);

    expect(store.write).toHaveBeenCalledTimes(1);
    const [, written] = store.write.mock.calls[0]!;
    expect((written as { symbol: string }[]).map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
  });

  // The behaviour that was broken in production: a cold process, rate limited on
  // its very first call, with nothing in the in-memory cache to fall back on.
  it('serves the persisted snapshot when rate limited on a cold start', async () => {
    const saved = [
      { symbol: 'BTC', name: 'Bitcoin', price: 64000, change24hPercent: -0.5, lastUpdated: 'x' },
      { symbol: 'ETH', name: 'Ethereum', price: 1900, change24hPercent: 0.2, lastUpdated: 'x' },
    ];
    const store = {
      read: vi.fn().mockResolvedValue({ prices: saved, fetchedAt: new Date(Date.now() - 8 * 60_000) }),
      write: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const result = await new CoinGeckoProvider(undefined, '', store).getPrices(hodler);

    expect(result.status).toBe('fallback');
    expect(result.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(result.source).toMatch(/saved/i);
    expect(result.notice).toMatch(/rate limiting/i);
    expect(result.notice).toMatch(/8 minutes ago/);
  });

  it('prefers the in-process cache over the persisted snapshot', async () => {
    const store = {
      read: vi.fn().mockResolvedValue({ prices: [{ symbol: 'OLD' }], fetchedAt: new Date() }),
      write: vi.fn().mockResolvedValue(undefined),
    };
    const provider = new CoinGeckoProvider(undefined, '', store);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(marketPayload())));
    await provider.getPrices(hodler);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));
    const result = await provider.getPrices(hodler);

    expect(result.data.map((p) => p.symbol)).toEqual(['BTC', 'ETH']);
    expect(store.read).not.toHaveBeenCalled();
  });

  it('reports an error only when both cache tiers are empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));

    const result = await new CoinGeckoProvider(undefined, '', emptyStore).getPrices(hodler);

    expect(result.status).toBe('error');
    expect(result.data).toEqual([]);
  });

  it('does not fail when the snapshot store throws', async () => {
    const store = {
      read: vi.fn().mockRejectedValue(new Error('db down')),
      write: vi.fn().mockRejectedValue(new Error('db down')),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(marketPayload())));

    const result = await new CoinGeckoProvider(undefined, '', store).getPrices(hodler);

    expect(result.status).toBe('ok');
    expect(result.data).toHaveLength(2);
  });
});

describe('news summary truncation', () => {
  function feedWithDescription(description: string) {
    return {
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          `<rss><channel><item><title>A headline</title><description>${description}</description><link>https://example.com/1</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`,
        ),
      json: () => Promise.resolve({}),
    } as unknown as Response;
  }

  async function summaryFor(description: string) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(feedWithDescription(description)));
    const items = await new RssNewsProvider([
      { name: 'Test', url: 'https://example.com/rss' },
    ]).getNews();
    return items[0]!.summary;
  }

  it('keeps a short description intact and unmarked', async () => {
    const summary = await summaryFor('Bitcoin held steady through the session.');
    expect(summary).toBe('Bitcoin held steady through the session.');
    expect(summary).not.toMatch(/…$/);
  });

  it('ends a long description on a sentence boundary', async () => {
    const long =
      'Bitcoin held steady through the European session as traders weighed the latest inflation print. ' +
      'Analysts pointed to thin liquidity across major venues and a lack of conviction in either direction. ' +
      'Volumes remained subdued into the afternoon.';

    const summary = (await summaryFor(long))!;

    expect(summary.length).toBeLessThan(long.length);
    expect(summary).toMatch(/[.!?]$/);
    expect(summary).not.toMatch(/…/);
  });

  it('never cuts in the middle of a word', async () => {
    const noPunctuation = `${'extraordinarily '.repeat(30)}end`;

    const summary = (await summaryFor(noPunctuation))!;
    const trimmed = summary.replace(/…$/, '').trim();

    expect(trimmed.endsWith('extraordinarily')).toBe(true);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('strips HTML out of the description', async () => {
    const summary = await summaryFor('&lt;p&gt;Bitcoin &lt;b&gt;rose&lt;/b&gt; today.&lt;/p&gt;');
    expect(summary).not.toMatch(/[<>]/);
    expect(summary).toContain('rose');
  });
});
