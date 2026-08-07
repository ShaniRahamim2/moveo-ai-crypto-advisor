import type { Meme, MemeProvider, ProviderResult } from '../types.js';
import { MEMES } from './memes.js';

/**
 * Rotates on every dashboard refresh and never repeats the meme just shown, so
 * the change is always visible.
 */
export class StaticMemeProvider implements MemeProvider {
  readonly name = 'meme';

  constructor(private readonly memes: Meme[] = MEMES) {}

  getMeme(previousId?: string): Promise<ProviderResult<Meme>> {
    const candidates =
      this.memes.length > 1 ? this.memes.filter((m) => m.id !== previousId) : this.memes;

    const index = Math.floor(Math.random() * candidates.length);
    const meme = candidates[index] ?? this.memes[0];

    if (!meme) {
      return Promise.resolve({
        status: 'error',
        data: { id: 'none', imageUrl: '', caption: '', subcaption: '', altText: '' },
        source: 'curated',
        fetchedAt: new Date().toISOString(),
        notice: 'No meme is available right now.',
      });
    }

    return Promise.resolve({
      status: 'ok',
      data: meme,
      source: 'curated',
      fetchedAt: new Date().toISOString(),
    });
  }
}
