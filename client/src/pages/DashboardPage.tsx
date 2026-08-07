import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useDashboard } from '../dashboard/queries';
import { relativeTime } from '../dashboard/format';
import { SectionCard } from '../components/dashboard/SectionCard';
import { CoinPricesSection } from '../components/dashboard/CoinPricesSection';
import { MarketNewsSection } from '../components/dashboard/MarketNewsSection';
import { InsightSection } from '../components/dashboard/InsightSection';
import { MemeSection } from '../components/dashboard/MemeSection';
import { DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { PersonalizationSummary } from '../components/PersonalizationSummary';
import { Button } from '../components/ui/Button';
import type { CoinPrice, DashboardSection, Insight, Meme, NewsItem } from '../dashboard/types';

function renderSection(section: DashboardSection, showSparklines: boolean) {
  switch (section.type) {
    case 'COIN_PRICES':
      return (
        <CoinPricesSection prices={section.data as CoinPrice[]} showSparklines={showSparklines} />
      );
    case 'MARKET_NEWS':
      return <MarketNewsSection items={section.data as NewsItem[]} />;
    case 'AI_INSIGHT':
      return <InsightSection insight={section.data as Insight} />;
    case 'MEME':
      return <MemeSection meme={section.data as Meme} />;
  }
}

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const previousMemeId = useRef<string | null>(null);
  const [waking, setWaking] = useState(false);

  const { data, isPending, error, isFetching, refetch } = useDashboard(() => previousMemeId.current);

  // Remember the meme just shown so the next refresh cannot repeat it.
  useEffect(() => {
    const memeSection = data?.sections.find((s) => s.type === 'MEME');
    if (memeSection) {
      previousMemeId.current = (memeSection.data as Meme).id;
    }
  }, [data]);

  // The backend sleeps when idle, so a slow first load is expected rather than
  // broken. The flag is raised from the timer and cleared on cleanup, so it
  // resets whenever the pending state changes.
  useEffect(() => {
    if (!isPending) return;

    const timer = setTimeout(() => setWaking(true), 2500);
    return () => {
      clearTimeout(timer);
      setWaking(false);
    };
  }, [isPending]);

  async function handleRefresh() {
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ['feedback'] });
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">
                {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Your briefing'}
              </h1>
              {data && (
                <p className="mt-1 text-sm text-slate-500">
                  Updated {relativeTime(data.generatedAt)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleRefresh} disabled={isFetching}>
                {isFetching ? 'Refreshing…' : 'Refresh'}
              </Button>
              <Button variant="secondary" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>

          {data && (
            <div className="mt-4 border-t border-edge pt-4">
              <PersonalizationSummary
                preferences={{
                  selectedAssets: data.personalization.selectedAssets,
                  investorType: data.personalization.investorType,
                  contentPreferences: data.personalization.contentPreferences,
                  updatedAt: data.generatedAt,
                }}
              />
            </div>
          )}
        </header>

        {isPending && <DashboardSkeleton waking={waking} />}

        {error && !data && (
          <div className="rounded-xl border border-edge bg-raised p-6">
            <p className="text-sm text-slate-200">Your dashboard could not be loaded.</p>
            <p className="mt-1 text-sm text-slate-500">
              The server may still be waking up. Try again in a moment.
            </p>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleRefresh}>Try again</Button>
              <Link
                to="/preferences"
                className="rounded-md border border-edge px-4 py-2 text-sm text-slate-200 hover:bg-raised"
              >
                Edit preferences
              </Link>
            </div>
          </div>
        )}

        {data && (
          <div className="space-y-4 sm:space-y-5">
            {data.sections.map((section) => (
              <SectionCard
                key={section.type}
                section={section}
                generated={section.type === 'AI_INSIGHT'}
              >
                {renderSection(section, data.personalization.showSparklines)}
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
