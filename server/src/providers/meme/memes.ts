import { z } from 'zod';
import { logger } from '../../lib/logger.js';
import manifest from '../../data/memes.json' with { type: 'json' };
import type { Meme } from '../types.js';

/**
 * Meme images are self-hosted: the files live in `client/public/memes/` and are
 * served from the frontend's own origin. Nothing is scraped and nothing is
 * hotlinked, so no third-party outage can empty the section.
 *
 * `memes.json` is the only thing that needs editing to add or remove one. Drop
 * an image into that folder, add a row, done — no code change. Entries that do
 * not match the shape are skipped with a warning rather than crashing the
 * section, since the manifest is hand-edited.
 */
const memeSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().min(1),
  altText: z.string().min(1),
});

function loadMemes(): Meme[] {
  const entries = Array.isArray(manifest) ? manifest : [];
  const valid: Meme[] = [];

  for (const [index, entry] of entries.entries()) {
    const parsed = memeSchema.safeParse(entry);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      logger.warn('meme_manifest_entry_invalid', {
        index,
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
  }

  if (valid.length === 0) {
    logger.error('meme_manifest_empty');
  }

  return valid;
}

export const MEMES: Meme[] = loadMemes();
