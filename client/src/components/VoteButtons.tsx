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

const SUMMARY_LABEL: Record<'UP' | 'DOWN', string> = {
  UP: 'Marked useful',
  DOWN: 'Marked not useful',
};

interface VoteButtonsProps {
  sectionType: SectionType;
  contentRef: string;
  label: string;
  /** MEME uses "Hide" rather than "Not useful", because that is what it does. */
  downLabel?: string;
  /** Icons only, with the labels kept in the tooltip and the accessible name. */
  compact?: boolean;
  /** Overrides the tooltip and accessible name where "useful" is the wrong word. */
  upTooltip?: string;
  downTooltip?: string;
  onVoted?: (vote: 'UP' | 'DOWN') => void;
}

export function VoteButtons({
  sectionType,
  contentRef,
  label,
  downLabel = 'Not useful',
  compact = false,
  upTooltip,
  downTooltip,
  onVoted,
}: VoteButtonsProps) {
  const upText = upTooltip ?? `Useful — ${label}`;
  const downText = downTooltip ?? `${downLabel} — ${label}`;
  const { data } = useFeedback();
  const submitVote = useSubmitVote();
  const current = findVote(data?.feedback, sectionType, contentRef);

  const [acknowledged, setAcknowledged] = useState<'UP' | 'DOWN' | null>(null);
  // Reopened after a stored vote, so the choice stays changeable.
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    if (!acknowledged) return;
    const timer = setTimeout(() => setAcknowledged(null), 4000);
    return () => clearTimeout(timer);
  }, [acknowledged]);

  function vote(next: 'UP' | 'DOWN') {
    submitVote.mutate({ sectionType, contentRef, vote: next });
    setAcknowledged(next);
    setReopened(false);
    onVoted?.(next);
  }

  const base = compact
    ? 'inline-flex items-center justify-center rounded-md border p-1.5 transition-colors duration-500'
    : 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors duration-500';

  // Once a vote is stored and the confirmation has faded, the pair collapses to a
  // single control. It stays changeable — removing the control outright would
  // read as broken to anyone who changes their mind — but two buttons per
  // section is clutter once the choice is made.
  if (current !== null && !acknowledged && !reopened) {
    return (
      <button
        type="button"
        onClick={() => setReopened(true)}
        aria-label={`${SUMMARY_LABEL[current]}: ${label}. Change your rating.`}
        title="Change your rating"
        className="inline-flex items-center gap-1.5 rounded-md border border-edge px-2 py-1 text-[11px] text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
      >
        {current === 'UP' ? (
          <ThumbsUpIcon className="h-3.5 w-3.5 text-gain" filled />
        ) : (
          <ThumbsDownIcon className="h-3.5 w-3.5 text-loss" filled />
        )}
        {!compact && (
          <span>
            {SUMMARY_LABEL[current]} <span className="text-slate-500">· change</span>
          </span>
        )}
      </button>
    );
  }

  // Colour is a confirmation, not a persisted badge, so it fades with the
  // message rather than outliving it.
  const confirming = acknowledged;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => vote('UP')}
          aria-pressed={current === 'UP'}
          aria-label={upText}
          title={upText}
          className={`${base} ${
            confirming === 'UP'
              ? 'border-gain bg-gain/15 text-gain'
              : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          <ThumbsUpIcon filled={confirming === 'UP'} />
          {!compact && <span>Useful</span>}
        </button>

        <button
          type="button"
          onClick={() => vote('DOWN')}
          aria-pressed={current === 'DOWN'}
          aria-label={downText}
          title={downText}
          className={`${base} ${
            confirming === 'DOWN'
              ? 'border-loss bg-loss/15 text-loss'
              : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          <ThumbsDownIcon filled={confirming === 'DOWN'} />
          {!compact && <span>{downLabel}</span>}
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
