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
