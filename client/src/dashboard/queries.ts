import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Dashboard } from './types';

/**
 * The previous meme id is read at fetch time rather than at render time. What
 * matters is which meme was on screen when the refresh was triggered, and a
 * value captured during render would already be stale by then.
 */
export function useDashboard(getPreviousMemeId: () => string | null) {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => {
      const previous = getPreviousMemeId();
      const query = previous ? `?previousMeme=${encodeURIComponent(previous)}` : '';
      return apiFetch<Dashboard>(`/api/dashboard${query}`);
    },
    staleTime: 60_000,
  });
}
