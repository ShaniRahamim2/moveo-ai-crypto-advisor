import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ContentPreference, InvestorType, PreferenceOptions, Preferences } from './types';

export interface PreferencesPayload {
  selectedAssets: string[];
  investorType: InvestorType;
  contentPreferences: ContentPreference[];
}

export function usePreferenceOptions() {
  return useQuery({
    queryKey: ['preference-options'],
    queryFn: () => apiFetch<PreferenceOptions>('/api/preferences/options'),
    staleTime: Infinity,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiFetch<{ preferences: Preferences | null }>('/api/preferences'),
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PreferencesPayload) =>
      apiFetch<{ preferences: Preferences }>('/api/preferences', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['preferences'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
