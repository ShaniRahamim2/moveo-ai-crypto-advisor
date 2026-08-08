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

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

const SUMMARY_MAX = 200;

/**
 * Feed descriptions are usually the opening of the article. Cutting them to a
 * fixed length leaves a sentence severed mid-thought, which reads as broken
 * rather than brief, so this ends on a sentence where possible, then a clause,
 * and only ever on a word boundary.
 */
function toSummary(raw: string): string {
  const text = stripTags(raw);
  if (text.length <= SUMMARY_MAX) return text;

  const window = text.slice(0, SUMMARY_MAX + 60);

  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (sentenceEnd >= 80) return window.slice(0, sentenceEnd + 1).trim();

  const clauseEnd = Math.max(window.lastIndexOf('; '), window.lastIndexOf(', '));
  if (clauseEnd >= 80) return `${window.slice(0, clauseEnd).trim()}…`;

  const wordEnd = window.slice(0, SUMMARY_MAX).lastIndexOf(' ');
  return `${window.slice(0, wordEnd > 0 ? wordEnd : SUMMARY_MAX).trim()}…`;
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

        // Feeds ship HTML in the description; the UI shows a single line, so it
        // is stripped and capped here rather than trusted into the DOM.
        const rawSummary = tagValue(block, 'description');
        const summary = rawSummary ? toSummary(rawSummary) : '';

        const publishedAt = pubDate ? new Date(pubDate) : new Date();
        if (Number.isNaN(publishedAt.getTime())) return null;

        return {
          title,
          ...(summary && summary !== title ? { summary } : {}),
          url: link,
          source: sourceName,
          publishedAt: publishedAt.toISOString(),
          assets: detectAssets(title),
        } satisfies NewsItem;
      })
      .filter((item): item is NewsItem => item !== null);
  }
}
