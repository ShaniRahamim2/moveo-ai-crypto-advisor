import { useState } from 'react';
import type { Insight } from '../../dashboard/types';

export function InsightSection({ insight }: { insight: Insight }) {
  // With no usable summary the full text shows uncollapsed, so a malformed model
  // reply costs the summary rather than the section.
  const collapsible = Boolean(insight.summary);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {collapsible && !expanded ? (
        <>
          <p className="text-[15px] leading-relaxed text-slate-100">{insight.summary}</p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded={false}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            Read more
          </button>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-slate-100">{insight.text}</p>
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded
              className="mt-2 text-sm font-medium text-accent hover:underline"
            >
              Show less
            </button>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        {insight.aiGenerated ? insight.disclaimer : 'Written from market data without AI.'}
      </p>
    </div>
  );
}
