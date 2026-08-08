import type { Meme, MemeProvider, ProviderResult } from '../types.js';
import { MEMES } from './memes.js';

export interface MemeDeck {
  current: Meme;
  /** Everything the user can browse, current included, in a stable order. */
  deck: Meme[];
  hiddenCount: number;
  totalCount: number;
  /** True when every meme was hidden and the deck was shown anyway. */
  exhausted: boolean;
}

/**
 * Rotates on every dashboard refresh and never repeats the meme just shown.
 *
 * A thumbs-down hides a meme for that account permanently, so the deck shrinks
 * as the user rejects them. If every meme is hidden the full set is shown again
 * rather than leaving the section empty, and the caller is told so it can offer
 * a reset — silently resurrecting rejected memes with no explanation would look
 * like the feedback had been ignored.
 */
export class StaticMemeProvider implements MemeProvider {
  readonly name = 'meme';

  constructor(private readonly memes: Meme[] = MEMES) {}

  getMeme(previousId?: string, hiddenIds: Set<string> = new Set()): Promise<ProviderResult<MemeDeck>> {
    const visible = this.memes.filter((m) => !hiddenIds.has(m.id));
    const exhausted = visible.length === 0;
    const deck = exhausted ? this.memes : visible;

    if (deck.length === 0) {
      return Promise.resolve({
        status: 'error',
        data: {
          current: { id: 'none', imageUrl: '', caption: '', subcaption: '', altText: '' },
          deck: [],
          hiddenCount: 0,
          totalCount: 0,
          exhausted: false,
        },
        source: 'curated',
        fetchedAt: new Date().toISOString(),
        notice: 'No meme is available right now.',
      });
    }

    const candidates = deck.length > 1 ? deck.filter((m) => m.id !== previousId) : deck;
    const current = candidates[Math.floor(Math.random() * candidates.length)] ?? deck[0]!;

    return Promise.resolve({
      status: 'ok',
      data: {
        current,
        deck,
        hiddenCount: this.memes.length - visible.length,
        totalCount: this.memes.length,
        exhausted,
      },
      source: 'curated',
      fetchedAt: new Date().toISOString(),
      ...(exhausted
        ? {
            notice:
              'You have hidden every meme, so the full set is showing again. Reset below to start over.',
          }
        : {}),
    });
  }
}
