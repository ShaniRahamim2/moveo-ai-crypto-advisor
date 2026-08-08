import { useEffect, useState } from 'react';
import { ThumbsDownIcon, ThumbsUpIcon } from './ui/icons';
import { findVote, useFeedback, useSubmitVote, type SectionType } from '../feedback/queries';

const ACKNOWLEDGEMENT: Record<SectionType, { UP: string; DOWN: string }> = {
  MARKET_NEWS: {
    UP: 'Thanks — more headlines like these.',
    DOWN: 'Thanks — fewer headlines like these.',
  },
  COIN_PRICES: {
    UP: 'Thanks — this mix of assets is working.',
    DOWN: 'Thanks — try editing your assets above.',
  },
  AI_INSIGHT: {
    UP: 'Thanks — more briefings framed this way.',
    DOWN: 'Thanks — this framing missed the mark.',
  },
  MEME: {
    UP: 'Thanks — more like this one.',
    DOWN: 'Hidden. You will not see this meme again.',
  },
};

interface VoteButtonsProps {
  sectionType: SectionType;
  contentRef: string;
  label: string;
  /** MEME uses "Hide" rather than "Not useful", because that is what it does. */
  downLabel?: string;
  onVoted?: (vote: 'UP' | 'DOWN') => void;
}

export function VoteButtons({
  sectionType,
  contentRef,
  label,
  downLabel = 'Not useful',
  onVoted,
}: VoteButtonsProps) {
  const { data } = useFeedback();
  const submitVote = useSubmitVote();
  const current = findVote(data?.feedback, sectionType, contentRef);
  const [acknowledged, setAcknowledged] = useState<'UP' | 'DOWN' | null>(null);

  // The message answers the click; it is not a permanent badge on the section.
  useEffect(() => {
    if (!acknowledged) return;
    const timer = setTimeout(() => setAcknowledged(null), 4000);
    return () => clearTimeout(timer);
  }, [acknowledged]);

  function vote(next: 'UP' | 'DOWN') {
    submitVote.mutate({ sectionType, contentRef, vote: next });
    setAcknowledged(next);
    onVoted?.(next);
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors';

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => vote('UP')}
          aria-pressed={current === 'UP'}
          aria-label={`Useful: ${label}`}
          title={`Useful — ${label}`}
          className={`${base} ${
            current === 'UP'
              ? 'border-gain bg-gain/15 text-gain'
              : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          <ThumbsUpIcon filled={current === 'UP'} />
          <span>Useful</span>
        </button>

        <button
          type="button"
          onClick={() => vote('DOWN')}
          aria-pressed={current === 'DOWN'}
          aria-label={`${downLabel}: ${label}`}
          title={`${downLabel} — ${label}`}
          className={`${base} ${
            current === 'DOWN'
              ? 'border-loss bg-loss/15 text-loss'
              : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          <ThumbsDownIcon filled={current === 'DOWN'} />
          <span>{downLabel}</span>
        </button>
      </div>

      {acknowledged && (
        <span
          role="status"
          className="max-w-[15rem] text-[11px] leading-tight text-accent sm:text-right"
        >
          {ACKNOWLEDGEMENT[sectionType][acknowledged]}
        </span>
      )}
    </div>
  );
}
