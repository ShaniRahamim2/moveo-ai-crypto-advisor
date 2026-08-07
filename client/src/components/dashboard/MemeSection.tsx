import { useState } from 'react';
import type { Meme } from '../../dashboard/types';

export function MemeSection({ meme }: { meme: Meme }) {
  const [failed, setFailed] = useState(false);

  if (!meme.imageUrl || failed) {
    return (
      <p className="text-sm text-slate-400">
        {meme.caption ? `${meme.caption} — ${meme.subcaption}` : 'No meme to show right now.'}
      </p>
    );
  }

  return (
    <figure>
      <img
        key={meme.id}
        src={meme.imageUrl}
        alt={meme.altText}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full rounded-lg border border-edge bg-surface"
      />
      {(meme.caption || meme.subcaption) && (
        <figcaption className="mt-3 text-xs text-slate-500">
          {[meme.caption, meme.subcaption].filter(Boolean).join(' · ')}
        </figcaption>
      )}
    </figure>
  );
}
