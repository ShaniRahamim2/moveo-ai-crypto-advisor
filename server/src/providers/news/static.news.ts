import type { NewsItem } from '../types.js';

/**
 * Tier 3, last resort. Always labelled as sample content in the UI — it must
 * never be mistaken for live news. Dates are resolved relative to now so the
 * list does not read as obviously frozen, but the label is what tells the truth.
 */
interface StaticEntry {
  title: string;
  url: string;
  source: string;
  hoursAgo: number;
  assets: string[];
}

const ENTRIES: StaticEntry[] = [
  {
    title: 'Spot Bitcoin ETFs record a fourth consecutive week of net inflows',
    url: 'https://www.coindesk.com/',
    source: 'Sample content',
    hoursAgo: 3,
    assets: ['BTC'],
  },
  {
    title: 'Ethereum layer-2 activity reaches a new share of total network transactions',
    url: 'https://cointelegraph.com/',
    source: 'Sample content',
    hoursAgo: 6,
    assets: ['ETH'],
  },
  {
    title: 'Solana developer activity climbs as new tooling ships',
    url: 'https://decrypt.co/',
    source: 'Sample content',
    hoursAgo: 9,
    assets: ['SOL'],
  },
  {
    title: 'Stablecoin supply expands as payment integrations widen',
    url: 'https://www.coindesk.com/',
    source: 'Sample content',
    hoursAgo: 14,
    assets: [],
  },
  {
    title: 'Regulators publish updated guidance for digital asset custody',
    url: 'https://cointelegraph.com/',
    source: 'Sample content',
    hoursAgo: 20,
    assets: [],
  },
  {
    title: 'NFT marketplace volumes shift toward a smaller set of collections',
    url: 'https://decrypt.co/',
    source: 'Sample content',
    hoursAgo: 26,
    assets: ['ETH'],
  },
];

export function getStaticNews(): NewsItem[] {
  const now = Date.now();

  return ENTRIES.map((entry) => ({
    title: entry.title,
    url: entry.url,
    source: entry.source,
    publishedAt: new Date(now - entry.hoursAgo * 3600_000).toISOString(),
    assets: entry.assets,
  }));
}
