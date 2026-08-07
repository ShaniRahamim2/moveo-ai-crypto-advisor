import { useEffect, useState } from 'react';
import { findVote, useFeedback, useSubmitVote, type SectionType } from '../feedback/queries';

const ACKNOWLEDGEMENT: Record<SectionType, { UP: string; DOWN: string }> = {
  MARKET_NEWS: {
    UP: 'Noted — more headlines like this one.',
    DOWN: 'Noted — fewer headlines like this one.',
  },
  COIN_PRICES: {
    UP: 'Noted — this mix of assets is working.',
    DOWN: 'Noted — try editing your assets above.',
  },
  AI_INSIGHT: {
    UP: 'Noted — more briefings framed this way.',
    DOWN: 'Noted — this framing missed the mark.',
  },
  MEME: {
    UP: 'Noted — more of this kind.',
    DOWN: 'Noted — fewer of this kind.',
  },
};

interface VoteButtonsProps {
  sectionType: SectionType;
  contentRef: string;
  label: string;
}

export function VoteButtons({ sectionType, contentRef, label }: VoteButtonsProps) {
  const { data } = useFeedback();
  const submitVote = useSubmitVote();
  const current = findVote(data?.feedback, sectionType, contentRef);
  const [acknowledged, setAcknowledged] = useState(false);

  // The message is a response to the click, not a permanent badge on the
  // section, so it clears itself.
  useEffect(() => {
    if (!acknowledged) return;
    const timer = setTimeout(() => setAcknowledged(false), 4000);
    return () => clearTimeout(timer);
  }, [acknowledged]);

  function vote(next: 'UP' | 'DOWN') {
    submitVote.mutate({ sectionType, contentRef, vote: next });
    setAcknowledged(true);
  }

  return (
    <div className="flex items-center gap-2">
      {acknowledged && current && (
        <span role="status" className="text-xs text-slate-400">
          {ACKNOWLEDGEMENT[sectionType][current]}
        </span>
      )}

      <button
        type="button"
        onClick={() => vote('UP')}
        aria-pressed={current === 'UP'}
        aria-label={`Helpful: ${label}`}
        className={`rounded-md border px-2 py-1 text-sm transition-colors ${
          current === 'UP'
            ? 'border-gain bg-gain/15 text-gain'
            : 'border-edge text-slate-400 hover:text-slate-200'
        }`}
      >
        <span aria-hidden="true">▲</span>
      </button>

      <button
        type="button"
        onClick={() => vote('DOWN')}
        aria-pressed={current === 'DOWN'}
        aria-label={`Not helpful: ${label}`}
        className={`rounded-md border px-2 py-1 text-sm transition-colors ${
          current === 'DOWN'
            ? 'border-loss bg-loss/15 text-loss'
            : 'border-edge text-slate-400 hover:text-slate-200'
        }`}
      >
        <span aria-hidden="true">▼</span>
      </button>
    </div>
  );
}
