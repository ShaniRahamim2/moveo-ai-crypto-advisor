import type { Insight } from '../../dashboard/types';

export function InsightSection({ insight }: { insight: Insight }) {
  return (
    <div>
      <p className="text-[15px] leading-relaxed text-slate-100">{insight.text}</p>

      <p className="mt-4 text-xs text-slate-500">
        {insight.aiGenerated ? insight.disclaimer : 'Written from market data without AI.'}
      </p>
    </div>
  );
}
