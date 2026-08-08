import { ExternalLinkIcon, ThumbsDownIcon } from '../ui/icons';
import { relativeTime } from '../../dashboard/format';
import { useResetHidden, useSubmitVote } from '../../feedback/queries';
import type { NewsItem } from '../../dashboard/types';

interface MarketNewsSectionProps {
  items: NewsItem[];
  hiddenCount: number;
}

export function MarketNewsSection({ items, hiddenCount }: MarketNewsSectionProps) {
  const submitVote = useSubmitVote();
  const resetHidden = useResetHidden();

  function dismiss(item: NewsItem) {
    // Article dismissals share the feedback table with section votes, under
    // their own reference prefix.
    submitVote.mutate({
      sectionType: 'MARKET_NEWS',
      contentRef: `article:${item.url}`,
      vote: 'DOWN',
    });
  }

  if (items.length === 0) {
    return (
      <div>
        <p className="text-sm text-slate-500">
          {hiddenCount > 0
            ? 'You have hidden every headline in this batch.'
            : 'No recent headlines for your assets.'}
        </p>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => resetHidden.mutate('MARKET_NEWS')}
            className="mt-3 text-xs text-accent hover:underline"
          >
            Show hidden articles again ({hiddenCount})
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-edge">
        {items.map((item) => (
          <li key={item.url} className="py-3 first:pt-0">
            <div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <p className="text-sm font-medium leading-snug text-accent group-hover:underline">
                  {item.title}
                </p>

                {item.summary && (
                  <p className="mt-1 truncate text-xs text-slate-400">{item.summary}</p>
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

              <button
                type="button"
                onClick={() => dismiss(item)}
                aria-label={`Show me less like this: ${item.title}`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-edge px-2 py-1 text-[11px] text-slate-500 hover:border-slate-500 hover:text-slate-300"
              >
                <ThumbsDownIcon className="h-3.5 w-3.5" />
                Show me less like this
              </button>
            </div>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => resetHidden.mutate('MARKET_NEWS')}
          disabled={resetHidden.isPending}
          className="mt-3 text-xs text-accent hover:underline disabled:opacity-50"
        >
          {resetHidden.isPending ? 'Restoring…' : `Show hidden articles again (${hiddenCount})`}
        </button>
      )}
    </div>
  );
}
