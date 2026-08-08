import { describe, expect, it } from 'vitest';
import type { ContentPreference } from '@prisma/client';
import { buildPersonalizationContext } from '../src/services/personalization.js';

const hodler = {
  selectedAssets: ['BTC', 'ETH'],
  investorType: 'HODLER' as const,
  contentPreferences: ['MARKET_NEWS' as const, 'CHARTS' as const],
};

const trader = {
  selectedAssets: ['SOL', 'DOGE'],
  investorType: 'DAY_TRADER' as const,
  contentPreferences: ['SOCIAL' as const, 'FUN' as const],
};

describe('buildPersonalizationContext', () => {
  it('resolves selected assets to CoinGecko ids', () => {
    expect(buildPersonalizationContext(hodler).coingeckoIds).toEqual(['bitcoin', 'ethereum']);
    expect(buildPersonalizationContext(trader).coingeckoIds).toEqual(['solana', 'dogecoin']);
  });

  it('produces different asset sets for different profiles', () => {
    const a = buildPersonalizationContext(hodler);
    const b = buildPersonalizationContext(trader);

    expect(a.selectedAssets).not.toEqual(b.selectedAssets);
    expect(a.coingeckoIds).not.toEqual(b.coingeckoIds);
  });

  it('preserves the order the user selected assets in', () => {
    const context = buildPersonalizationContext({ ...hodler, selectedAssets: ['ETH', 'BTC'] });
    expect(context.selectedAssets).toEqual(['ETH', 'BTC']);
    expect(context.coingeckoIds).toEqual(['ethereum', 'bitcoin']);
  });

  it('normalizes lowercase symbols', () => {
    const context = buildPersonalizationContext({ ...hodler, selectedAssets: ['btc'] });
    expect(context.selectedAssets).toEqual(['BTC']);
    expect(context.coingeckoIds).toEqual(['bitcoin']);
  });

  it('carries investor type into the AI context with distinct framing', () => {
    const a = buildPersonalizationContext(hodler);
    const b = buildPersonalizationContext(trader);

    expect(a.aiContext.investorType).toBe('HODLER');
    expect(b.aiContext.investorType).toBe('DAY_TRADER');
    expect(a.aiContext.framing).not.toBe(b.aiContext.framing);
    expect(a.aiContext.framing).toMatch(/long-term/i);
    expect(b.aiContext.framing).toMatch(/short-term/i);
  });

  it('gives every investor type its own framing', () => {
    const framings = (['HODLER', 'DAY_TRADER', 'NFT_COLLECTOR'] as const).map(
      (investorType) => buildPersonalizationContext({ ...hodler, investorType }).aiContext.framing,
    );

    expect(new Set(framings).size).toBe(3);
  });

  it('never puts buy or sell advice in the framing', () => {
    for (const investorType of ['HODLER', 'DAY_TRADER', 'NFT_COLLECTOR'] as const) {
      const { framing } = buildPersonalizationContext({ ...hodler, investorType }).aiContext;
      expect(framing).not.toMatch(/\b(buy|sell|invest in|price target)\b/i);
    }
  });

  it('changes section order based on content preferences', () => {
    expect(buildPersonalizationContext(hodler).sectionOrder).not.toEqual(
      buildPersonalizationContext(trader).sectionOrder,
    );
  });

  it('puts the section a preference maps to first', () => {
    const cases = [
      { preference: 'MARKET_NEWS' as const, expected: 'MARKET_NEWS' },
      { preference: 'CHARTS' as const, expected: 'COIN_PRICES' },
      { preference: 'SOCIAL' as const, expected: 'MARKET_NEWS' },
      { preference: 'FUN' as const, expected: 'MEME' },
    ];

    for (const { preference, expected } of cases) {
      const context = buildPersonalizationContext({
        ...hodler,
        contentPreferences: [preference],
      });
      expect(context.sectionOrder[0]).toBe(expected);
    }
  });

  it('always returns all four sections regardless of preferences', () => {
    const combinations = [
      ['MARKET_NEWS'],
      ['CHARTS'],
      ['SOCIAL'],
      ['FUN'],
      ['MARKET_NEWS', 'CHARTS'],
      ['SOCIAL', 'FUN'],
      ['MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN'],
    ] as const;

    for (const contentPreferences of combinations) {
      const { sectionOrder } = buildPersonalizationContext({
        ...hodler,
        contentPreferences: [...contentPreferences],
      });

      expect(sectionOrder).toHaveLength(4);
      expect([...sectionOrder].sort()).toEqual([
        'AI_INSIGHT',
        'COIN_PRICES',
        'MARKET_NEWS',
        'MEME',
      ]);
    }
  });

  it('turns sparklines on only when Charts is selected', () => {
    expect(buildPersonalizationContext(hodler).includeSparklines).toBe(true);
    expect(buildPersonalizationContext(trader).includeSparklines).toBe(false);
  });

  it('weights news by social signal only when Social is selected', () => {
    expect(buildPersonalizationContext(trader).weightNewsBySocialSignal).toBe(true);
    expect(buildPersonalizationContext(hodler).weightNewsBySocialSignal).toBe(false);
  });

  it('gives each of the four preferences an observable effect', () => {
    const baseline = buildPersonalizationContext({ ...hodler, contentPreferences: ['MARKET_NEWS'] });

    const effects = {
      CHARTS: buildPersonalizationContext({ ...hodler, contentPreferences: ['CHARTS'] }),
      SOCIAL: buildPersonalizationContext({ ...hodler, contentPreferences: ['SOCIAL'] }),
      FUN: buildPersonalizationContext({ ...hodler, contentPreferences: ['FUN'] }),
    };

    expect(effects.CHARTS.includeSparklines).toBe(true);
    expect(effects.SOCIAL.weightNewsBySocialSignal).toBe(true);
    expect(effects.FUN.sectionOrder).not.toEqual(baseline.sectionOrder);
    expect(baseline.sectionOrder[0]).toBe('MARKET_NEWS');
  });

  it('excludes credentials and identifiers from the AI context', () => {
    const context = buildPersonalizationContext(hodler);
    const serialized = JSON.stringify(context.aiContext).toLowerCase();

    for (const forbidden of ['email', 'password', 'token', 'hash', 'userid', '@']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(Object.keys(context.aiContext).sort()).toEqual([
      'assets',
      'contentFocus',
      'framing',
      'investorType',
    ]);
  });

  it('is pure — repeated calls with equal input give equal output', () => {
    expect(buildPersonalizationContext(hodler)).toEqual(buildPersonalizationContext(hodler));
  });
});

describe('coin prices placement', () => {
  const ALL: ContentPreference[] = ['MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN'];

  function everyCombination(): ContentPreference[][] {
    const combos: ContentPreference[][] = [];
    for (let mask = 1; mask < 1 << ALL.length; mask++) {
      combos.push(ALL.filter((_, i) => mask & (1 << i)));
    }
    return combos;
  }

  // A financial product that reaches prices last does not read as one, whatever
  // the preferences say.
  it('never places prices below second, across all 15 combinations', () => {
    const combos = everyCombination();
    expect(combos).toHaveLength(15);

    for (const contentPreferences of combos) {
      const { sectionOrder } = buildPersonalizationContext({ ...hodler, contentPreferences });
      const position = sectionOrder.indexOf('COIN_PRICES');

      expect(position, `prices at ${position} for ${contentPreferences.join('+')}`).toBeLessThan(2);
      expect(sectionOrder).toHaveLength(4);
    }
  });

  it('still lets a preference promote another section above prices', () => {
    expect(
      buildPersonalizationContext({ ...hodler, contentPreferences: ['FUN'] }).sectionOrder[0],
    ).toBe('MEME');
    expect(
      buildPersonalizationContext({ ...hodler, contentPreferences: ['MARKET_NEWS'] }).sectionOrder[0],
    ).toBe('MARKET_NEWS');
  });

  it('leads with prices when Charts is selected', () => {
    expect(
      buildPersonalizationContext({ ...hodler, contentPreferences: ['CHARTS'] }).sectionOrder[0],
    ).toBe('COIN_PRICES');
  });
});
