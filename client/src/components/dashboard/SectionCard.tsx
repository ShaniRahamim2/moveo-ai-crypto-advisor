import type { ReactNode } from 'react';
import { VoteButtons } from '../VoteButtons';
import { ChevronDownIcon } from '../ui/icons';
import { relativeTime } from '../../dashboard/format';
import { useCollapsedSection } from '../../dashboard/useCollapsedSection';
import type { DashboardSection } from '../../dashboard/types';

interface SectionCardProps {
  section: DashboardSection;
  children: ReactNode;
  /** The AI section is visually separated so generated text is never mistaken for data. */
  generated?: boolean;
  downLabel?: string;
  compactVote?: boolean;
  upTooltip?: string;
  downTooltip?: string;
  downHoldMs?: number;
  /** Market News votes per article instead, so its section control is hidden. */
  hideVote?: boolean;
  actions?: ReactNode;
  onVoted?: (vote: 'UP' | 'DOWN') => void;
}

export function SectionCard({
  section,
  children,
  generated = false,
  downLabel,
  compactVote = false,
  upTooltip,
  downTooltip,
  downHoldMs,
  hideVote = false,
  actions,
  onVoted,
}: SectionCardProps) {
  const { collapsed, toggle } = useCollapsedSection(section.type);
  const bodyId = `section-body-${section.type}`;

  return (
    <section
      aria-labelledby={`section-${section.type}`}
      className={`rounded-xl border p-5 sm:p-6 ${
        generated ? 'border-accent/35 bg-accent/[0.04]' : 'border-edge bg-raised'
      }`}
    >
      <header
        className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${
          collapsed ? '' : 'mb-4'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${section.title}`}
            title={collapsed ? 'Expand section' : 'Collapse section'}
            className="mt-0.5 shrink-0 rounded text-slate-500 transition-colors hover:text-slate-200"
          >
            <ChevronDownIcon
              className={`h-4 w-4 transition-transform duration-300 ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
          </button>

          <div className="min-w-0">
            <h2 id={`section-${section.type}`} className="text-sm font-semibold text-slate-200">
              {section.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {section.source}
              {/* The insight source already carries its own recency wording. */}
              {section.type !== 'AI_INSIGHT' &&
                section.fetchedAt &&
                ` · ${relativeTime(section.fetchedAt)}`}
            </p>
          </div>
        </div>

        {/* Voting stays reachable when the body is folded away — collapsing a
            section should not cost the ability to rate it. */}
        <div className="flex shrink-0 items-center gap-2 sm:self-start">
          {actions}
          {!hideVote && (
            <VoteButtons
              key={section.contentRef}
              sectionType={section.type}
              contentRef={section.contentRef}
              label={section.title}
              compact={compactVote}
              {...(upTooltip ? { upTooltip } : {})}
              {...(downTooltip ? { downTooltip } : {})}
              {...(downHoldMs ? { downHoldMs } : {})}
              {...(downLabel ? { downLabel } : {})}
              {...(onVoted ? { onVoted } : {})}
            />
          )}
        </div>
      </header>

      {/* Animated with grid rows rather than max-height, so the fold matches the
          content's real height instead of an arbitrary cap. */}
      <div
        id={bodyId}
        aria-hidden={collapsed}
        className={`grid transition-all duration-300 ease-out ${
          collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100'
        }`}
      >
        <div className="overflow-hidden">
          {section.notice && (
            <p className="mb-4 rounded-lg border border-edge bg-surface px-3 py-2 text-xs text-slate-300">
              {section.notice}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}
