import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons';
import { useResetHidden } from '../../feedback/queries';
import { useHiddenContent } from '../../feedback/hidden';
import type { Meme, MemeDeck } from '../../dashboard/types';

interface MemeSectionProps {
  deck: MemeDeck;
  visible: Meme[];
  current: Meme | null;
  onSelect: (meme: Meme) => void;
}

export function MemeSection({ deck, visible, current, onSelect }: MemeSectionProps) {
  const resetHidden = useResetHidden();
  const { memeIds } = useHiddenContent();
  const hiddenCount = memeIds.size;

  const resetControl = hiddenCount > 0 && (
    <button
      type="button"
      onClick={() => resetHidden.mutate('MEME')}
      disabled={resetHidden.isPending}
      className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
    >
      {resetHidden.isPending ? 'Restoring…' : 'Show hidden memes again'}
    </button>
  );

  if (!current || visible.length === 0) {
    return (
      <div>
        <p className="text-sm text-slate-500">
          {hiddenCount > 0
            ? 'You have hidden every meme.'
            : 'No meme to show right now.'}
        </p>
        {resetControl}
      </div>
    );
  }

  const index = Math.max(
    0,
    visible.findIndex((m) => m.id === current.id),
  );
  const canBrowse = visible.length > 1;

  return (
    <div>
      {/*
        Every meme in the deck is mounted and only the current one is visible.
        Swapping a single src blanks the card while the next image decodes, which
        looked broken on local files that load in milliseconds. Holding them all
        removes the gap entirely; the whole set is a few hundred kilobytes.
      */}
      <figure>
        <div className="relative overflow-hidden rounded-lg border border-edge bg-surface">
          {visible.map((meme) => (
            <img
              key={meme.id}
              src={meme.imageUrl}
              alt={meme.id === current.id ? current.altText : ''}
              aria-hidden={meme.id === current.id ? undefined : true}
              className={
                meme.id === current.id
                  ? 'w-full'
                  : 'pointer-events-none absolute inset-0 h-full w-full opacity-0'
              }
            />
          ))}
        </div>

        {(current.caption || current.subcaption) && (
          <figcaption className="mt-3 text-xs text-slate-500">
            {[current.caption, current.subcaption].filter(Boolean).join(' · ')}
          </figcaption>
        )}
      </figure>

      {canBrowse && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(visible[(index - 1 + visible.length) % visible.length]!)}
            aria-label="Previous meme"
            title="Previous meme"
            className="inline-flex items-center justify-center rounded-md border border-edge p-1.5 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => onSelect(visible[(index + 1) % visible.length]!)}
            aria-label="Next meme"
            title="Next meme"
            className="inline-flex items-center justify-center rounded-md border border-edge p-1.5 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {resetControl}
      {deck.exhausted && (
        <p className="mt-2 text-xs text-slate-500">
          You had hidden every meme, so the full set is showing again.
        </p>
      )}
    </div>
  );
}
