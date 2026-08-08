import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prismaMock.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { DashboardService } = await import('../src/services/dashboard.service.js');
const { StaticMemeProvider } = await import('../src/providers/meme/meme.provider.js');

const okResult = <T>(data: T, source = 'test') => ({
  status: 'ok' as const,
  data,
  source,
  fetchedAt: new Date().toISOString(),
});

const prices = [
  { symbol: 'BTC', name: 'Bitcoin', price: 64783, change24hPercent: -1.2, lastUpdated: 'x' },
  { symbol: 'ETH', name: 'Ethereum', price: 1912.75, change24hPercent: 0.4, lastUpdated: 'x' },
];

const news = [
  {
    title: 'Bitcoin ETFs record weekly inflows',
    url: 'https://example.com/1',
    source: 'CoinDesk',
    publishedAt: new Date().toISOString(),
    assets: ['BTC'],
  },
];

const meme = {
  id: 'meme-003',
  imageUrl: '/memes/meme-003.svg',
  caption: 'HODL',
  subcaption: 'x',
  altText: 'alt',
};

const memeDeck = { current: meme, deck: [meme], hiddenCount: 0, totalCount: 1, exhausted: false };

function providers(overrides: Record<string, unknown> = {}) {
  return {
    market: { name: 'market', getPrices: vi.fn().mockResolvedValue(okResult(prices)) },
    news: { name: 'news', getNews: vi.fn().mockResolvedValue(okResult(news)) },
    meme: { name: 'meme', getMeme: vi.fn().mockResolvedValue(okResult(memeDeck)) },
    insight: {
      getInsight: vi
        .fn()
        .mockResolvedValue(okResult({ text: 'BTC slipped 1.20%.', disclaimer: 'd', generatedAt: 'x', aiGenerated: true })),
    },
    ...overrides,
  };
}

function build(p: ReturnType<typeof providers>, previousMeme?: string) {
  return new DashboardService(
    p.market as never,
    p.news as never,
    p.meme as never,
    p.insight as never,
  ).build('user_1', previousMeme);
}

beforeEach(() => {
  resetPrismaMock();
  prismaMock.userPreference.findUnique.mockResolvedValue({
    selectedAssets: ['BTC', 'ETH'],
    investorType: 'HODLER',
    contentPreferences: ['MARKET_NEWS', 'CHARTS'],
    updatedAt: new Date(),
  });
});

describe('DashboardService', () => {
  it('returns all four sections', async () => {
    const dashboard = await build(providers());

    expect(dashboard.sections).toHaveLength(4);
    expect([...dashboard.sections.map((s) => s.type)].sort()).toEqual([
      'AI_INSIGHT',
      'COIN_PRICES',
      'MARKET_NEWS',
      'MEME',
    ]);
  });

  it('gives every section its own content reference', async () => {
    const dashboard = await build(providers());
    const refs = dashboard.sections.map((s) => s.contentRef);

    expect(new Set(refs).size).toBe(4);
    for (const ref of refs) expect(ref.length).toBeGreaterThan(0);
  });

  it('orders sections by content preference', async () => {
    // News + Charts weight MARKET_NEWS and COIN_PRICES equally, so the tie breaks
    // on the base order and prices lead.
    const both = await build(providers());
    expect(both.sections[0]!.type).toBe('COIN_PRICES');
    expect(both.order.slice(0, 2)).toEqual(['COIN_PRICES', 'MARKET_NEWS']);

    prismaMock.userPreference.findUnique.mockResolvedValue({
      selectedAssets: ['SOL'],
      investorType: 'DAY_TRADER',
      contentPreferences: ['FUN'],
      updatedAt: new Date(),
    });
    const memeFirst = await build(providers());

    expect(memeFirst.sections[0]!.type).toBe('MEME');
    expect(memeFirst.sections).toHaveLength(4);
    expect(memeFirst.order).not.toEqual(both.order);
  });

  it('puts news first when news is the only content preference', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValue({
      selectedAssets: ['BTC'],
      investorType: 'HODLER',
      contentPreferences: ['MARKET_NEWS'],
      updatedAt: new Date(),
    });

    const dashboard = await build(providers());
    expect(dashboard.sections[0]!.type).toBe('MARKET_NEWS');
  });

  // The single most important reliability behaviour in the app.
  it('keeps the other three sections ok when the market provider fails', async () => {
    const p = providers({
      market: {
        name: 'market',
        getPrices: vi.fn().mockResolvedValue({
          status: 'error' as const,
          data: [],
          source: 'coingecko',
          fetchedAt: new Date().toISOString(),
          notice: 'Prices could not be loaded.',
        }),
      },
    });

    const dashboard = await build(p);
    const byType = Object.fromEntries(dashboard.sections.map((s) => [s.type, s]));

    expect(byType.COIN_PRICES!.status).toBe('error');
    expect(byType.COIN_PRICES!.notice).toBeTruthy();
    expect(byType.MARKET_NEWS!.status).toBe('ok');
    expect(byType.AI_INSIGHT!.status).toBe('ok');
    expect(byType.MEME!.status).toBe('ok');
  });

  it('survives a provider that throws rather than degrading', async () => {
    const p = providers({
      news: { name: 'news', getNews: vi.fn().mockRejectedValue(new Error('boom')) },
    });

    const dashboard = await build(p);
    const byType = Object.fromEntries(dashboard.sections.map((s) => [s.type, s]));

    expect(dashboard.sections).toHaveLength(4);
    expect(byType.MARKET_NEWS!.status).toBe('error');
    expect(byType.MARKET_NEWS!.data).toEqual([]);
    expect(byType.COIN_PRICES!.status).toBe('ok');
    expect(byType.MEME!.status).toBe('ok');
  });

  it('still returns four sections when every provider fails', async () => {
    const fail = (name: string, method: string) => ({
      name,
      [method]: vi.fn().mockRejectedValue(new Error('down')),
    });

    const dashboard = await build(
      providers({
        market: fail('market', 'getPrices'),
        news: fail('news', 'getNews'),
        meme: fail('meme', 'getMeme'),
        insight: { getInsight: vi.fn().mockRejectedValue(new Error('down')) },
      }),
    );

    expect(dashboard.sections).toHaveLength(4);
    for (const section of dashboard.sections) {
      expect(section.status).toBe('error');
      expect(section.notice).toBeTruthy();
    }
  });

  it('surfaces a fallback status distinctly from an error', async () => {
    const p = providers({
      news: {
        name: 'news',
        getNews: vi.fn().mockResolvedValue({
          status: 'fallback' as const,
          data: news,
          source: 'Sample content',
          fetchedAt: new Date().toISOString(),
          notice: 'This is sample content.',
        }),
      },
    });

    const dashboard = await build(p);
    const newsSection = dashboard.sections.find((s) => s.type === 'MARKET_NEWS')!;

    expect(newsSection.status).toBe('fallback');
    expect(newsSection.source).toBe('Sample content');
    expect(newsSection.notice).toMatch(/sample/i);
  });

  it('passes the previous meme id through so the meme changes on refresh', async () => {
    const p = providers();
    await build(p, 'meme-003');

    expect(p.meme.getMeme).toHaveBeenCalledWith('meme-003', expect.any(Set));
  });

  it('reports the personalization actually applied', async () => {
    const dashboard = await build(providers());

    expect(dashboard.personalization.selectedAssets).toEqual(['BTC', 'ETH']);
    expect(dashboard.personalization.investorType).toBe('HODLER');
    expect(dashboard.personalization.showSparklines).toBe(true);
  });

  it('gives the AI insight to the model with the prices and news from this build', async () => {
    const p = providers();
    await build(p);

    const [, passedPrices, passedNews] = p.insight.getInsight.mock.calls[0]!;
    expect(passedPrices).toEqual(prices);
    expect(passedNews).toEqual(news);
  });
});

describe('hidden content', () => {
  it('removes dismissed articles from the news section', async () => {
    const many = [
      { title: 'A', url: 'https://example.com/a', source: 's', publishedAt: new Date().toISOString(), assets: [] },
      { title: 'B', url: 'https://example.com/b', source: 's', publishedAt: new Date().toISOString(), assets: [] },
      { title: 'C', url: 'https://example.com/c', source: 's', publishedAt: new Date().toISOString(), assets: [] },
    ];
    prismaMock.feedback.findMany.mockResolvedValue([
      { sectionType: 'MARKET_NEWS', contentRef: 'article:https://example.com/b' },
    ]);

    const dashboard = await build(
      providers({ news: { name: 'news', getNews: vi.fn().mockResolvedValue(okResult(many)) } }),
    );
    const section = dashboard.sections.find((s) => s.type === 'MARKET_NEWS')!;

    expect((section.data as { url: string }[]).map((i) => i.url)).toEqual([
      'https://example.com/a',
      'https://example.com/c',
    ]);
    expect(dashboard.hiddenCounts.articles).toBe(1);
  });

  it('passes hidden meme ids to the meme provider', async () => {
    prismaMock.feedback.findMany.mockResolvedValue([
      { sectionType: 'MEME', contentRef: 'meme:meme-001' },
      { sectionType: 'MEME', contentRef: 'meme:meme-002' },
    ]);

    const p = providers();
    const dashboard = await build(p);

    const [, hiddenIds] = p.meme.getMeme.mock.calls[0]!;
    expect([...(hiddenIds as Set<string>)].sort()).toEqual(['meme-001', 'meme-002']);
    expect(dashboard.hiddenCounts.memes).toBe(2);
  });

  it('ignores section-level votes when building the hidden sets', async () => {
    prismaMock.feedback.findMany.mockResolvedValue([
      { sectionType: 'MARKET_NEWS', contentRef: 'news:abc123' },
      { sectionType: 'MEME', contentRef: 'meme:meme-005' },
    ]);

    const dashboard = await build(providers());

    expect(dashboard.hiddenCounts.articles).toBe(0);
    expect(dashboard.hiddenCounts.memes).toBe(1);
  });

  it('shows everything when the hidden lookup fails', async () => {
    prismaMock.feedback.findMany.mockRejectedValue(new Error('db down'));

    const dashboard = await build(providers());

    expect(dashboard.sections).toHaveLength(4);
    expect(dashboard.hiddenCounts).toEqual({ memes: 0, articles: 0 });
  });
});

// The assignment requires the meme to change each time the dashboard updates.
// This regressed silently once because nothing asserted it.
describe('meme rotation on refresh', () => {
  function realMemeProviders() {
    return providers({ meme: new StaticMemeProvider() });
  }

  it('returns a different meme on consecutive fetches for the same user', async () => {
    const p = realMemeProviders();

    let previous: string | undefined;
    for (let i = 0; i < 25; i++) {
      const dashboard = await build(p, previous);
      const section = dashboard.sections.find((s) => s.type === 'MEME')!;
      const current = (section.data as { current: { id: string } }).current.id;

      if (previous !== undefined) {
        expect(current, `refresh ${i} repeated ${previous}`).not.toBe(previous);
      }
      previous = current;
    }
  });

  it('exposes the rotated meme as the section content reference', async () => {
    const p = realMemeProviders();
    const dashboard = await build(p);
    const section = dashboard.sections.find((s) => s.type === 'MEME')!;
    const current = (section.data as { current: { id: string } }).current.id;

    expect(section.contentRef).toBe(`meme:${current}`);
  });

  it('never rotates onto a hidden meme', async () => {
    prismaMock.feedback.findMany.mockResolvedValue([
      { sectionType: 'MEME', contentRef: 'meme:meme-001' },
      { sectionType: 'MEME', contentRef: 'meme:meme-002' },
      { sectionType: 'MEME', contentRef: 'meme:meme-003' },
    ]);
    const p = realMemeProviders();

    for (let i = 0; i < 20; i++) {
      const dashboard = await build(p);
      const section = dashboard.sections.find((s) => s.type === 'MEME')!;
      const data = section.data as { current: { id: string }; deck: { id: string }[] };

      expect(['meme-001', 'meme-002', 'meme-003']).not.toContain(data.current.id);
      expect(data.deck.map((m) => m.id)).not.toEqual(
        expect.arrayContaining(['meme-001', 'meme-002', 'meme-003']),
      );
    }
  });
});
