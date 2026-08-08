import { useCallback, useEffect, useRef, useState } from 'react';
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
import type {
  CoinPrice,
  Dashboard,
  DashboardSection,
  Insight,
  MemeDeck,
  NewsItem,
} from '../dashboard/types';

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const previousMemeId = useRef<string | null>(null);
  const [waking, setWaking] = useState(false);
  const [viewedMemeId, setViewedMemeId] = useState<string | null>(null);

  const { data, isPending, error, isFetching, refetch } = useDashboard(
    useCallback(() => previousMemeId.current, []),
  );

  const memeSection = data?.sections.find((s) => s.type === 'MEME');
  const deck = memeSection?.data as MemeDeck | undefined;

  // Derived, not synchronised: when a new deck arrives the viewed id is simply
  // no longer in it, so this falls back to that deck's own current meme.
  const memeIndex = deck
    ? Math.max(
        0,
        deck.deck.findIndex((m) => m.id === (viewedMemeId ?? deck.current.id)),
      )
    : 0;
  const currentMeme = deck ? (deck.deck[memeIndex] ?? deck.current) : null;

  // Remembering the meme on screen writes a ref, not state.
  useEffect(() => {
    if (currentMeme) previousMemeId.current = currentMeme.id;
  }, [currentMeme]);

  // The backend sleeps when idle, so a slow first load is expected, not broken.
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

  function renderSection(section: DashboardSection, dashboard: Dashboard) {
    switch (section.type) {
      case 'COIN_PRICES':
        return (
          <CoinPricesSection
            prices={section.data as CoinPrice[]}
            showSparklines={dashboard.personalization.showSparklines}
          />
        );
      case 'MARKET_NEWS':
        return (
          <MarketNewsSection
            items={section.data as NewsItem[]}
            hiddenCount={dashboard.hiddenCounts.articles}
          />
        );
      case 'AI_INSIGHT':
        return <InsightSection insight={section.data as Insight} />;
      case 'MEME':
        return (
          <MemeSection
            deck={section.data as MemeDeck}
            index={memeIndex}
            onIndexChange={(next) => setViewedMemeId(deck?.deck[next]?.id ?? null)}
          />
        );
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">
                {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'Your briefing'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {greeting()}
                {data && (
                  <span className="text-slate-500"> · updated {relativeTime(data.generatedAt)}</span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
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
            <div className="mt-4 flex flex-wrap gap-2">
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
                section={
                  section.type === 'MEME' && deck
                    ? { ...section, contentRef: `meme:${currentMeme?.id ?? deck.current.id}` }
                    : section
                }
                generated={section.type === 'AI_INSIGHT'}
                {...(section.type === 'MEME'
                  ? {
                      downLabel: 'Hide this',
                      // Hiding only takes effect on the next dashboard load, so
                      // move off the hidden meme immediately.
                      onVoted: (vote: 'UP' | 'DOWN') => {
                        if (vote === 'DOWN' && deck && deck.deck.length > 1) {
                          const next = (memeIndex + 1) % deck.deck.length;
                          setViewedMemeId(deck.deck[next]?.id ?? null);
                        }
                      },
                    }
                  : {})}
              >
                {renderSection(section, data)}
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
