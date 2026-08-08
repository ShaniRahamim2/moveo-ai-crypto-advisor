import type { ReactNode } from 'react';
import { VoteButtons } from '../VoteButtons';
import { relativeTime } from '../../dashboard/format';
import type { DashboardSection } from '../../dashboard/types';

interface SectionCardProps {
  section: DashboardSection;
  children: ReactNode;
  /** The AI section is visually separated so generated text is never mistaken for data. */
  generated?: boolean;
  downLabel?: string;
  onVoted?: (vote: 'UP' | 'DOWN') => void;
}

export function SectionCard({
  section,
  children,
  generated = false,
  downLabel,
  onVoted,
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={`section-${section.type}`}
      className={`rounded-xl border p-5 sm:p-6 ${
        generated ? 'border-accent/35 bg-accent/[0.04]' : 'border-edge bg-raised'
      }`}
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id={`section-${section.type}`} className="text-sm font-semibold text-slate-200">
            {section.title}
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {section.source}
            {section.fetchedAt && ` · ${relativeTime(section.fetchedAt)}`}
          </p>
        </div>

        <div className="shrink-0 sm:self-start">
          <VoteButtons
            sectionType={section.type}
            contentRef={section.contentRef}
            label={section.title}
            {...(downLabel ? { downLabel } : {})}
            {...(onVoted ? { onVoted } : {})}
          />
        </div>
      </header>

      {section.notice && (
        <p
          className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
            section.status === 'error'
              ? 'border-edge bg-surface text-slate-300'
              : 'border-edge bg-surface text-slate-400'
          }`}
        >
          {section.notice}
        </p>
      )}

      {children}
    </section>
  );
}
