import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { RefreshIcon } from '../ui/icons';
import type { CoinPrice, Dashboard, DashboardSection } from '../../dashboard/types';

/**
 * Matched to the server's price cache TTL rather than something shorter. A press
 * inside the cache window would return byte-identical data and read as a broken
 * button, and repeated presses would burn the CoinGecko quota the section
 * depends on.
 */
const COOLDOWN_SECONDS = 90;

export function PricesRefreshButton() {
  const queryClient = useQueryClient();
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function refresh() {
    setBusy(true);
    try {
      const { section } = await apiFetch<{ section: DashboardSection<CoinPrice[]> }>(
        '/api/dashboard/prices',
      );

      // The prices section is patched into the cached dashboard rather than the
      // whole dashboard being refetched. A full refetch would rebuild every
      // section — rotating the meme and re-running the insight — which is both
      // surprising and the opposite of why this endpoint exists.
      queryClient.setQueryData<Dashboard>(['dashboard'], (current) =>
        current
          ? {
              ...current,
              sections: current.sections.map((s) => (s.type === 'COIN_PRICES' ? section : s)),
            }
          : current,
      );

      setRemaining(COOLDOWN_SECONDS);
    } catch {
      // The section renders its own error state from the dashboard payload.
      setRemaining(COOLDOWN_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || remaining > 0;

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={disabled}
      aria-label={remaining > 0 ? `Refresh available in ${remaining} seconds` : 'Refresh prices'}
      title={
        remaining > 0
          ? `Prices are cached for ${COOLDOWN_SECONDS}s — available again in ${remaining}s`
          : 'Refresh prices'
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-edge px-2 py-1.5 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-edge disabled:hover:text-slate-400"
    >
      <RefreshIcon className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
      {remaining > 0 ? <span className="tabular-nums">{remaining}s</span> : <span>Refresh</span>}
    </button>
  );
}
