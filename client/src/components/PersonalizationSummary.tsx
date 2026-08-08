import type { Preferences } from '../preferences/types';

const INVESTOR_LABELS: Record<Preferences['investorType'], string> = {
  HODLER: 'HODLer',
  DAY_TRADER: 'Day Trader',
  NFT_COLLECTOR: 'NFT Collector',
};

const CONTENT_LABELS: Record<Preferences['contentPreferences'][number], string> = {
  MARKET_NEWS: 'News',
  CHARTS: 'Charts',
  SOCIAL: 'Social',
  FUN: 'Fun',
};

// Personalization the user cannot see reads as personalization that was not
// built, so the active profile is stated on the page.
export function PersonalizationSummary({ preferences }: { preferences: Preferences }) {
  const parts = [
    preferences.selectedAssets.join(', '),
    INVESTOR_LABELS[preferences.investorType],
    preferences.contentPreferences.map((c) => CONTENT_LABELS[c]).join(' + '),
  ];

  // The edit affordance is a header button now, so this line is purely a
  // statement of the profile driving the page.
  return <p className="text-sm text-slate-400">{parts.join(' · ')}</p>;
}
