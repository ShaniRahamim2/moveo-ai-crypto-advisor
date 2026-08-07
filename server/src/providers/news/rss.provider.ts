import { fetchText } from '../../lib/httpClient.js';
import { SUPPORTED_COINS } from '../../data/coins.js';
import type { NewsItem } from '../types.js';

const TIMEOUT_MS = 5000;

const FEEDS = [
  { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss' },
  { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
];

function stripCdata(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return match?.[1] ? decodeEntities(stripCdata(match[1])) : null;
}

// Asset tagging is inferred from the headline, since RSS carries no instrument
// metadata.
//
// Symbols are matched case-sensitively and names case-insensitively. Tickers are
// written in caps in headlines, while several symbols are also ordinary English
// words — a case-insensitive symbol match tagged "near-zero miner support" as
// NEAR, and "ONE", "SUI" and "TON" have the same problem.
function detectAssets(title: string): string[] {
  const found = new Set<string>();

  for (const coin of SUPPORTED_COINS) {
    const symbolHit = new RegExp(`\\b${coin.symbol}\\b`).test(title);
    const nameHit = new RegExp(
      `\\b${coin.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(title);

    if (symbolHit || nameHit) found.add(coin.symbol);
  }

  return [...found];
}

/**
 * Tier 2. Genuinely live, no key, no bot protection. Verified reachable from the
 * deployed backend before being relied on.
 */
export class RssNewsProvider {
  readonly name = 'rss';

  constructor(private readonly feeds = FEEDS) {}

  async getNews(): Promise<NewsItem[]> {
    const settled = await Promise.allSettled(
      this.feeds.map(async (feed) => this.parseFeed(feed.name, await fetchText(feed.url, {
        timeoutMs: TIMEOUT_MS,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      }))),
    );

    const items = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    if (items.length === 0) {
      throw new Error('No RSS feed returned usable items');
    }

    return items;
  }

  private parseFeed(sourceName: string, xml: string): NewsItem[] {
    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

    return blocks
      .map((block) => {
        const title = tagValue(block, 'title');
        const link = tagValue(block, 'link');
        const pubDate = tagValue(block, 'pubDate');
        if (!title || !link) return null;

        const publishedAt = pubDate ? new Date(pubDate) : new Date();
        if (Number.isNaN(publishedAt.getTime())) return null;

        return {
          title,
          url: link,
          source: sourceName,
          publishedAt: publishedAt.toISOString(),
          assets: detectAssets(title),
        } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => item !== null);
  }
}
