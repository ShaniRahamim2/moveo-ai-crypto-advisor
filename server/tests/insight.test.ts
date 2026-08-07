import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from './helpers/prismaMock.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { InsightService, buildContextHash, DISCLAIMER } = await import(
  '../src/services/insight.service.js'
);
const { buildPersonalizationContext } = await import('../src/services/personalization.js');
const { buildInsightPrompt, clampInsight, SYSTEM_PROMPT } = await import(
  '../src/providers/ai/prompt.js'
);
const { ProviderError } = await import('../src/lib/httpClient.js');

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

function stubProvider(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: 'stub',
    model: 'stub-model:free',
    configured: true,
    generateInsight: vi.fn().mockResolvedValue('BTC slipped 1.20% to $64,783 over the past day.'),
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock();
  prismaMock.insightCache.findUnique.mockResolvedValue(null);
  prismaMock.insightCache.create.mockResolvedValue({});
});

describe('buildContextHash', () => {
  it('differs between profiles', () => {
    expect(buildContextHash(hodler)).not.toBe(buildContextHash(trader));
  });

  it('is stable for the same profile on the same day', () => {
    expect(buildContextHash(hodler, '2026-08-07')).toBe(buildContextHash(hodler, '2026-08-07'));
  });

  it('changes when the day changes', () => {
    expect(buildContextHash(hodler, '2026-08-07')).not.toBe(
      buildContextHash(hodler, '2026-08-08'),
    );
  });

  it('ignores the order assets were selected in', () => {
    const reversed = buildPersonalizationContext({
      selectedAssets: ['ETH', 'BTC'],
      investorType: 'HODLER',
      contentPreferences: ['CHARTS', 'MARKET_NEWS'],
    });
    expect(buildContextHash(hodler, '2026-08-07')).toBe(buildContextHash(reversed, '2026-08-07'));
  });
});

describe('InsightService', () => {
  it('generates and caches an insight on a miss', async () => {
    const provider = stubProvider();
    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    expect(result.status).toBe('ok');
    expect(result.data.aiGenerated).toBe(true);
    expect(result.data.disclaimer).toBe(DISCLAIMER);
    expect(prismaMock.insightCache.create).toHaveBeenCalledTimes(1);
  });

  it('serves the cached insight without calling the model again', async () => {
    prismaMock.insightCache.findUnique.mockResolvedValue({
      insightText: 'Cached text from earlier today.',
      model: 'stub-model:free',
      generatedAt: new Date('2026-08-07T06:00:00Z'),
    });

    const provider = stubProvider();
    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    expect(provider.generateInsight).not.toHaveBeenCalled();
    expect(result.status).toBe('ok');
    expect(result.data.text).toBe('Cached text from earlier today.');
    expect(result.source).toMatch(/cached/i);
  });

  it('falls back without AI on HTTP 429 and does not cache the fallback', async () => {
    const provider = stubProvider({
      generateInsight: vi.fn().mockRejectedValue(new ProviderError('rate_limited', 'limit', 429)),
    });

    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    expect(result.status).toBe('fallback');
    expect(result.data.aiGenerated).toBe(false);
    expect(result.notice).toMatch(/rate limited/i);
    expect(prismaMock.insightCache.create).not.toHaveBeenCalled();
  });

  it('falls back without AI on timeout', async () => {
    const provider = stubProvider({
      generateInsight: vi.fn().mockRejectedValue(new ProviderError('timeout', 'exceeded 12000ms')),
    });

    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    expect(result.status).toBe('fallback');
    expect(result.data.aiGenerated).toBe(false);
    expect(result.notice).toMatch(/unavailable/i);
  });

  it('builds the fallback from the real market data on the page', async () => {
    const provider = stubProvider({
      generateInsight: vi.fn().mockRejectedValue(new ProviderError('timeout', 'x')),
    });

    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    // BTC has the larger absolute move, so it should lead.
    expect(result.data.text).toContain('BTC');
    expect(result.data.text).toContain('-1.20%');
    expect(result.data.text).toContain('$64,783');
    expect(result.data.text).toContain('Bitcoin ETFs record weekly inflows');
  });

  it('never invents data when prices and news are both empty', async () => {
    const provider = stubProvider({
      generateInsight: vi.fn().mockRejectedValue(new ProviderError('timeout', 'x')),
    });

    const result = await new InsightService(provider as never).getInsight(hodler, [], []);

    expect(result.data.text).toMatch(/unavailable/i);
    expect(result.data.text).not.toMatch(/\$\d/);
  });

  it('falls back when the provider is not configured, without calling it', async () => {
    const provider = stubProvider({ configured: false });

    const result = await new InsightService(provider as never).getInsight(hodler, prices, news);

    expect(provider.generateInsight).not.toHaveBeenCalled();
    expect(result.status).toBe('fallback');
  });

  it('still returns an insight when the cache write fails', async () => {
    prismaMock.insightCache.create.mockRejectedValue(new Error('db down'));

    const result = await new InsightService(stubProvider() as never).getInsight(hodler, prices, news);

    expect(result.status).toBe('ok');
    expect(result.data.aiGenerated).toBe(true);
  });

  it('still returns an insight when the cache read fails', async () => {
    prismaMock.insightCache.findUnique.mockRejectedValue(new Error('db down'));

    const result = await new InsightService(stubProvider() as never).getInsight(hodler, prices, news);

    expect(result.status).toBe('ok');
  });
});

describe('insight prompt', () => {
  const input = {
    assets: ['BTC', 'ETH'],
    investorType: 'HODLER' as const,
    framing: hodler.aiContext.framing,
    contentFocus: ['MARKET_NEWS' as const],
    prices: prices.map((p) => ({
      symbol: p.symbol,
      price: p.price,
      change24hPercent: p.change24hPercent,
    })),
    headlines: news.map((n) => ({ title: n.title, source: n.source })),
  };

  it('grounds the prompt in the supplied figures and headlines', () => {
    const prompt = buildInsightPrompt(input);

    expect(prompt).toContain('$64,783');
    expect(prompt).toContain('-1.20%');
    expect(prompt).toContain('Bitcoin ETFs record weekly inflows');
    expect(prompt).toContain('CoinDesk');
  });

  it('contains no email, password, token or user id', () => {
    const prompt = buildInsightPrompt(input).toLowerCase();

    for (const forbidden of ['email', 'password', 'token', 'passwordhash', 'userid', '@', 'bearer']) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it('instructs the model not to give trading advice or invent numbers', () => {
    expect(SYSTEM_PROMPT).toMatch(/never give buy, sell or hold advice/i);
    expect(SYSTEM_PROMPT).toMatch(/never invent a number/i);
  });

  it('bans the filler opening', () => {
    expect(SYSTEM_PROMPT).toMatch(/ever-evolving world of cryptocurrency/i);
  });
});

describe('insight length cap', () => {
  it('leaves a short insight untouched', () => {
    const short = 'BTC rose 1.00% to $65,111 today. ETH followed at $1,922.33.';
    expect(clampInsight(short)).toBe(short);
  });

  it('trims an over-long insight at a sentence boundary', () => {
    const sentence = 'Bitcoin moved modestly against a backdrop of steady institutional flows. ';
    const long = sentence.repeat(12);

    const result = clampInsight(long);

    expect(result.split(/\s+/).length).toBeLessThanOrEqual(120);
    expect(result.trimEnd()).toMatch(/[.!?]$/);
    expect(result.length).toBeLessThan(long.length);
  });

  it('cuts a single runaway sentence rather than returning it whole', () => {
    const runaway = `Bitcoin ${'moved '.repeat(200)}today`;
    const result = clampInsight(runaway);

    expect(result.split(/\s+/).length).toBeLessThanOrEqual(121);
    expect(result.endsWith('…')).toBe(true);
  });
})
