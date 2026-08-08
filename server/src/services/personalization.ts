import type { ContentPreference, InvestorType, SectionType } from '@prisma/client';
import { toCoingeckoIds } from '../data/coins.js';

export interface PreferenceInput {
  selectedAssets: string[];
  investorType: InvestorType;
  contentPreferences: ContentPreference[];
}

export interface AiContext {
  investorType: InvestorType;
  framing: string;
  assets: string[];
  contentFocus: ContentPreference[];
}

export interface PersonalizationContext {
  selectedAssets: string[];
  coingeckoIds: string[];
  investorType: InvestorType;
  contentPreferences: ContentPreference[];
  sectionOrder: SectionType[];
  includeSparklines: boolean;
  weightNewsBySocialSignal: boolean;
  aiContext: AiContext;
}

// Investor type changes how the data is framed, never the data itself, and never
// into a recommendation to buy or sell.
const FRAMING: Record<InvestorType, string> = {
  HODLER:
    'Frame for a long-term holder: multi-week context, what the move means for a position held through cycles. Do not treat a single day as a trend.',
  DAY_TRADER:
    'Frame for a short-term trader: recent volatility, notable 24h moves, and what is driving intraday attention.',
  NFT_COLLECTOR:
    'Frame for an NFT collector: ecosystem health, on-chain and collection-level activity, and what conditions mean for minting and trading.',
};

// All four sections always render. Preferences only change the order, so a
// preference is visible without ever removing content the assignment requires.
const BASE_ORDER: SectionType[] = ['COIN_PRICES', 'MARKET_NEWS', 'AI_INSIGHT', 'MEME'];

const PREFERENCE_WEIGHTS: Record<ContentPreference, Partial<Record<SectionType, number>>> = {
  MARKET_NEWS: { MARKET_NEWS: 10 },
  CHARTS: { COIN_PRICES: 10 },
  // The community signal we surface for Social lives on news items.
  SOCIAL: { MARKET_NEWS: 6, AI_INSIGHT: 2 },
  FUN: { MEME: 10 },
};

function orderSections(contentPreferences: ContentPreference[]): SectionType[] {
  const scores = new Map<SectionType, number>(BASE_ORDER.map((s) => [s, 0]));

  for (const preference of contentPreferences) {
    for (const [section, weight] of Object.entries(PREFERENCE_WEIGHTS[preference])) {
      const key = section as SectionType;
      scores.set(key, (scores.get(key) ?? 0) + weight);
    }
  }

  const ordered = [...BASE_ORDER].sort((a, b) => {
    const diff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    return diff !== 0 ? diff : BASE_ORDER.indexOf(a) - BASE_ORDER.indexOf(b);
  });

  // A preference may promote a section above prices, but never bury prices at
  // the bottom: a financial product that opens with a meme and reaches prices
  // last does not read as one. Prices are pinned to first or second place.
  const pricesAt = ordered.indexOf('COIN_PRICES');
  if (pricesAt > 1) {
    ordered.splice(pricesAt, 1);
    ordered.splice(1, 0, 'COIN_PRICES');
  }

  return ordered;
}

/**
 * The single source of personalization truth. Every downstream consumer — price
 * lookups, news filtering, AI prompting, section ordering — reads from this
 * result rather than inspecting preferences itself.
 *
 * Pure: no I/O, no clock, no randomness, so it is cheap to test exhaustively.
 */
export function buildPersonalizationContext(
  preferences: PreferenceInput,
): PersonalizationContext {
  const selectedAssets = preferences.selectedAssets.map((s) => s.toUpperCase());
  const contentPreferences = [...preferences.contentPreferences];

  return {
    selectedAssets,
    coingeckoIds: toCoingeckoIds(selectedAssets),
    investorType: preferences.investorType,
    contentPreferences,
    sectionOrder: orderSections(contentPreferences),
    includeSparklines: contentPreferences.includes('CHARTS'),
    weightNewsBySocialSignal: contentPreferences.includes('SOCIAL'),
    // Deliberately constructed from preference data only. No identifiers, no
    // credentials — this object is what gets sent to a third-party model.
    aiContext: {
      investorType: preferences.investorType,
      framing: FRAMING[preferences.investorType],
      assets: selectedAssets,
      contentFocus: contentPreferences,
    },
  };
}
