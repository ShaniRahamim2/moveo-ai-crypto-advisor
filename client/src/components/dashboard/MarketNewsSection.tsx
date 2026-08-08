import { useEffect, useState } from 'react';
import { ExternalLinkIcon, ThumbsDownIcon, ThumbsUpIcon } from '../ui/icons';
import { relativeTime } from '../../dashboard/format';
import { findVote, useFeedback, useResetHidden, useSubmitVote } from '../../feedback/queries';
import { ARTICLE_REF_PREFIX, useHiddenContent } from '../../feedback/hidden';
import type { NewsItem } from '../../dashboard/types';

function ArticleFeedback({
  item,
  dismissing,
  onDismiss,
}: {
  item: NewsItem;
  dismissing: boolean;
  onDismiss: () => void;
}) {
  const { data } = useFeedback();
  const submitVote = useSubmitVote();
  const [acknowledged, setAcknowledged] = useState(false);

  const contentRef = `${ARTICLE_REF_PREFIX}${item.url}`;
  const current = findVote(data?.feedback, 'MARKET_NEWS', contentRef);

  // Colour and message clear together: this is a confirmation of a click, not a
  // persisted badge on the article.
  useEffect(() => {
    if (!acknowledged) return;
    const timer = setTimeout(() => setAcknowledged(false), 4000);
    return () => clearTimeout(timer);
  }, [acknowledged]);

  const base =
    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors duration-500';
  const confirmingUp = acknowledged && current === 'UP';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          submitVote.mutate({ sectionType: 'MARKET_NEWS', contentRef, vote: 'UP' });
          setAcknowledged(true);
        }}
        aria-pressed={current === 'UP'}
        aria-label={`Show me more like this: ${item.title}`}
        className={`${base} ${
          confirmingUp
            ? 'border-gain bg-gain/15 text-gain'
            : 'border-edge text-slate-500 hover:border-slate-500 hover:text-slate-300'
        }`}
      >
        <ThumbsUpIcon className="h-3.5 w-3.5" filled={confirmingUp} />
        Show me more like this
      </button>

      <button
        type="button"
        onClick={onDismiss}
        disabled={dismissing}
        aria-label={`Show me less like this: ${item.title}`}
        className={`${base} ${
          dismissing
            ? 'border-loss bg-loss/20 text-loss'
            : 'border-edge text-slate-500 hover:border-slate-500 hover:text-slate-300'
        }`}
      >
        <ThumbsDownIcon className="h-3.5 w-3.5" filled={dismissing} />
        Show me less like this
      </button>

      {/* No recommender exists, so this promises only what actually happens: the
          vote and its context are recorded for the ranking work. */}
      {confirmingUp && (
        <span role="status" className="text-[11px] text-accent">
          Noted. We&rsquo;ll show you more like this.
        </span>
      )}
    </div>
  );
}

export function MarketNewsSection({ items }: { items: NewsItem[] }) {
  const resetHidden = useResetHidden();
  const submitVote = useSubmitVote();
  const { articleUrls } = useHiddenContent();

  // Held between the click and the removal so the control can turn red and the
  // row can animate out. An instant disappearance gives no confirmation that the
  // click registered.
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  function dismiss(item: NewsItem) {
    setDismissing((prev) => new Set(prev).add(item.url));

    setTimeout(() => {
      submitVote.mutate({
        sectionType: 'MARKET_NEWS',
        contentRef: `${ARTICLE_REF_PREFIX}${item.url}`,
        vote: 'DOWN',
      });

      // Released once the item is hidden and filtered out anyway. Leaving it in
      // the set made a restored article come back invisible, with its control
      // disabled — which read as "restore does nothing".
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(item.url);
        return next;
      });
    }, 450);
  }

  // Filtered here, not only on the server, so a dismissal is visible on click
  // rather than on the next dashboard load.
  const visible = items.filter((item) => !articleUrls.has(item.url));
  const hiddenCount = articleUrls.size;

  const resetControl = hiddenCount > 0 && (
    <button
      type="button"
      onClick={() => resetHidden.mutate('MARKET_NEWS')}
      disabled={resetHidden.isPending}
      className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
    >
      {resetHidden.isPending ? 'Restoring…' : `Show hidden articles again (${hiddenCount})`}
    </button>
  );

  if (visible.length === 0) {
    return (
      <div>
        <p className="text-sm text-slate-500">
          {hiddenCount > 0
            ? 'You have hidden every headline in this batch.'
            : 'No recent headlines for your assets.'}
        </p>
        {resetControl}
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-edge">
        {visible.map((item) => (
          <li
            key={item.url}
            className={`overflow-hidden py-3 transition-all duration-[450ms] first:pt-0 ${
              dismissing.has(item.url) ? 'max-h-0 -translate-x-4 py-0 opacity-0' : 'max-h-96 opacity-100'
            }`}
          >
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="group block">
              <p className="text-sm font-medium leading-snug text-accent group-hover:underline">
                {item.title}
              </p>

              {item.summary && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                  {item.summary}
                </p>
              )}

              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <ExternalLinkIcon className="h-3 w-3 shrink-0 text-accent opacity-80" />
                <span>{item.source}</span>
                <span aria-hidden="true">·</span>
                <span>{relativeTime(item.publishedAt)}</span>
                {item.assets.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-400">{item.assets.slice(0, 3).join(', ')}</span>
                  </>
                )}
              </p>
            </a>

            <ArticleFeedback
              item={item}
              dismissing={dismissing.has(item.url)}
              onDismiss={() => dismiss(item)}
            />
          </li>
        ))}
      </ul>

      {resetControl}
    </div>
  );
}
