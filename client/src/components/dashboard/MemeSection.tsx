import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';
import { useResetHidden } from '../../feedback/queries';
import type { MemeDeck } from '../../dashboard/types';

interface MemeSectionProps {
  deck: MemeDeck;
  /** Index of the meme on screen, owned by the page so voting can target it. */
  index: number;
  onIndexChange: (next: number) => void;
}

export function MemeSection({ deck, index, onIndexChange }: MemeSectionProps) {
  // Tracks which meme failed to load rather than a bare boolean, so browsing to
  // another meme clears the state without an effect.
  const [failedId, setFailedId] = useState<string | null>(null);
  const resetHidden = useResetHidden();

  const meme = deck.deck[index] ?? deck.current;
  const failed = failedId === meme.id;

  if (deck.deck.length === 0 || !meme.imageUrl) {
    return <p className="text-sm text-slate-500">No meme to show right now.</p>;
  }

  const canBrowse = deck.deck.length > 1;

  return (
    <div>
      <figure>
        {failed ? (
          <p className="rounded-lg border border-edge bg-surface px-4 py-6 text-center text-sm text-slate-400">
            {meme.altText}
          </p>
        ) : (
          <img
            key={meme.id}
            src={meme.imageUrl}
            alt={meme.altText}
            loading="lazy"
            onError={() => setFailedId(meme.id)}
            className="w-full rounded-lg border border-edge bg-surface"
          />
        )}

        {(meme.caption || meme.subcaption) && (
          <figcaption className="mt-3 text-xs text-slate-500">
            {[meme.caption, meme.subcaption].filter(Boolean).join(' · ')}
          </figcaption>
        )}
      </figure>

      {canBrowse && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + deck.deck.length) % deck.deck.length)}
            aria-label="Previous meme"
            className="inline-flex items-center gap-1 rounded-md border border-edge px-2.5 py-1.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <ChevronLeftIcon />
            Previous
          </button>

          <span className="text-xs tabular-nums text-slate-500">
            {index + 1} of {deck.deck.length}
            {deck.hiddenCount > 0 && !deck.exhausted && ` · ${deck.hiddenCount} hidden`}
          </span>

          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % deck.deck.length)}
            aria-label="Next meme"
            className="inline-flex items-center gap-1 rounded-md border border-edge px-2.5 py-1.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            Next
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {(deck.hiddenCount > 0 || deck.exhausted) && (
        <button
          type="button"
          onClick={() => resetHidden.mutate('MEME')}
          disabled={resetHidden.isPending}
          className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
        >
          {resetHidden.isPending
            ? 'Restoring…'
            : `Show hidden memes again (${deck.hiddenCount})`}
        </button>
      )}
    </div>
  );
}
