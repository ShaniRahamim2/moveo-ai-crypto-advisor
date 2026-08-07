import { createHash } from 'node:crypto';
import type { SectionType } from '@prisma/client';
import type { CoinPrice, Meme, NewsItem } from '../providers/types.js';

/**
 * A vote is attached to the specific content that was on screen when it was
 * cast, not just to the section. These references are generated server-side and
 * handed to the client in the dashboard payload so the client never invents one,
 * and they must stay stable across a refresh of the same content — otherwise a
 * restored vote would detach from what it referred to.
 */
export function pricesRef(symbols: string[]): string {
  return `prices:${[...symbols].sort().join(',')}`;
}

export function newsRef(items: NewsItem[]): string {
  if (items.length === 0) return 'news:empty';
  const digest = createHash('sha256')
    .update([...items.map((i) => i.url)].sort().join('|'))
    .digest('hex')
    .slice(0, 16);
  return `news:${digest}`;
}

export function insightRef(contextHash: string): string {
  return `insight:${contextHash.slice(0, 32)}`;
}

export function memeRef(meme: Meme): string {
  return `meme:${meme.id}`;
}

export function refFor(
  section: SectionType,
  payload: { prices?: CoinPrice[]; news?: NewsItem[]; contextHash?: string; meme?: Meme },
): string {
  switch (section) {
    case 'COIN_PRICES':
      return pricesRef((payload.prices ?? []).map((p) => p.symbol));
    case 'MARKET_NEWS':
      return newsRef(payload.news ?? []);
    case 'AI_INSIGHT':
      return insightRef(payload.contextHash ?? 'none');
    case 'MEME':
      return payload.meme ? memeRef(payload.meme) : 'meme:none';
  }
}
