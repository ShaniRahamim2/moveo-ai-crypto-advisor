import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export type SectionType = 'MARKET_NEWS' | 'COIN_PRICES' | 'AI_INSIGHT' | 'MEME';
export type Vote = 'UP' | 'DOWN';

export interface StoredVote {
  sectionType: SectionType;
  contentRef: string;
  vote: Vote;
  updatedAt: string;
}

export function useFeedback() {
  return useQuery({
    queryKey: ['feedback'],
    queryFn: () => apiFetch<{ feedback: StoredVote[] }>('/api/feedback'),
  });
}

/**
 * Un-hiding is the inverse of a dismissal and needs the same optimistic
 * treatment. Hiding was made instant by filtering on the feedback cache;
 * restoring has to clear that cache *and* refetch the dashboard, because the
 * server also filters hidden items out of the payload — so the restored items
 * are simply not present until a fresh fetch brings them back.
 */
export function useResetHidden() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sectionType: SectionType) =>
      apiFetch<{ restored: number }>('/api/feedback/reset-hidden', {
        method: 'POST',
        body: JSON.stringify({ sectionType }),
      }),

    onMutate: async (sectionType) => {
      await queryClient.cancelQueries({ queryKey: ['feedback'] });
      const previous = queryClient.getQueryData<{ feedback: StoredVote[] }>(['feedback']);

      const prefix = sectionType === 'MEME' ? 'meme:' : 'article:';
      queryClient.setQueryData<{ feedback: StoredVote[] }>(['feedback'], (current) => ({
        feedback: (current?.feedback ?? []).filter(
          (v) =>
            !(v.sectionType === sectionType && v.vote === 'DOWN' && v.contentRef.startsWith(prefix)),
        ),
      }));

      return { previous };
    },

    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['feedback'], context.previous);
      }
    },

    // Ordering matters and is the whole bug: the server filters hidden items out
    // of the dashboard payload, so a dashboard refetch that overlaps an
    // unsettled feedback state comes back filtered against the old hidden set
    // and the items stay gone. Feedback is refetched to completion first.
    onSettled: async () => {
      await queryClient.refetchQueries({ queryKey: ['feedback'] });
      await queryClient.refetchQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSubmitVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sectionType: SectionType; contentRef: string; vote: Vote }) =>
      apiFetch<{ feedback: StoredVote }>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // Reflect the vote immediately, then reconcile with the server. A vote that
    // takes a round trip to appear feels broken.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['feedback'] });
      const previous = queryClient.getQueryData<{ feedback: StoredVote[] }>(['feedback']);

      queryClient.setQueryData<{ feedback: StoredVote[] }>(['feedback'], (current) => {
        const rest = (current?.feedback ?? []).filter(
          (v) => !(v.sectionType === input.sectionType && v.contentRef === input.contentRef),
        );
        return {
          feedback: [...rest, { ...input, updatedAt: new Date().toISOString() }],
        };
      });

      return { previous };
    },

    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['feedback'], context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function findVote(
  votes: StoredVote[] | undefined,
  sectionType: SectionType,
  contentRef: string,
): Vote | null {
  return (
    votes?.find((v) => v.sectionType === sectionType && v.contentRef === contentRef)?.vote ?? null
  );
}
