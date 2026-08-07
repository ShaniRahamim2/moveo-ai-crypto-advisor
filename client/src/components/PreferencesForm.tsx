import { useState, type FormEvent } from 'react';
import { AssetPicker } from './AssetPicker';
import { Button } from './ui/Button';
import type {
  ContentPreference,
  InvestorType,
  PreferenceOptions,
  Preferences,
} from '../preferences/types';

export interface PreferencesDraft {
  selectedAssets: string[];
  investorType: InvestorType | null;
  contentPreferences: ContentPreference[];
}

interface PreferencesFormProps {
  options: PreferenceOptions;
  initial?: Preferences | null;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: (draft: {
    selectedAssets: string[];
    investorType: InvestorType;
    contentPreferences: ContentPreference[];
  }) => Promise<void>;
  error?: string | null;
  /** Offered during onboarding only — pointless on the edit screen. */
  showStarter?: boolean;
}

export function PreferencesForm({
  options,
  initial,
  submitLabel,
  submittingLabel,
  onSubmit,
  error,
  showStarter = false,
}: PreferencesFormProps) {
  const [draft, setDraft] = useState<PreferencesDraft>({
    selectedAssets: initial?.selectedAssets ?? [],
    investorType: initial?.investorType ?? null,
    contentPreferences: initial?.contentPreferences ?? [],
  });
  const [submitting, setSubmitting] = useState(false);

  const complete =
    draft.selectedAssets.length > 0 &&
    draft.investorType !== null &&
    draft.contentPreferences.length > 0;

  function toggleContent(value: ContentPreference) {
    setDraft((prev) => ({
      ...prev,
      contentPreferences: prev.contentPreferences.includes(value)
        ? prev.contentPreferences.filter((c) => c !== value)
        : [...prev.contentPreferences, value],
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!complete || !draft.investorType) return;

    setSubmitting(true);
    try {
      await onSubmit({
        selectedAssets: draft.selectedAssets,
        investorType: draft.investorType,
        contentPreferences: draft.contentPreferences,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isEmpty =
    draft.selectedAssets.length === 0 &&
    draft.investorType === null &&
    draft.contentPreferences.length === 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {showStarter && isEmpty && options.starterMix && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-raised px-4 py-3">
          <p className="text-sm text-slate-400">New to this? Start from a common setup.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setDraft({
                selectedAssets: [...options.starterMix.selectedAssets],
                investorType: options.starterMix.investorType,
                contentPreferences: [...options.starterMix.contentPreferences],
              })
            }
          >
            Not sure? Start with a popular mix
          </Button>
        </div>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-slate-200">
          Which assets are you interested in?
        </legend>
        <AssetPicker
          coins={options.coins}
          selected={draft.selectedAssets}
          maxAssets={options.maxAssets}
          onChange={(selectedAssets) => setDraft((prev) => ({ ...prev, selectedAssets }))}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-slate-200">What kind of investor are you?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {options.investorTypes.map((option) => {
            const active = draft.investorType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setDraft((prev) => ({ ...prev, investorType: option.value }))}
                className={`rounded-md border p-3 text-left transition-colors ${
                  active ? 'border-accent bg-accent/10' : 'border-edge hover:bg-raised'
                }`}
              >
                <span className="block text-sm font-medium text-slate-200">{option.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-slate-200">
          What would you like to see? Pick as many as you like.
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.contentPreferences.map((option) => {
            const active = draft.contentPreferences.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleContent(option.value)}
                className={`rounded-md border p-3 text-left transition-colors ${
                  active ? 'border-accent bg-accent/10' : 'border-edge hover:bg-raised'
                }`}
              >
                <span className="block text-sm font-medium text-slate-200">{option.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">
          These change what your dashboard leads with, and whether coin rows carry a 7-day trend.
          All four sections always appear.
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!complete || submitting}>
          {submitting ? submittingLabel : submitLabel}
        </Button>
        {!complete && (
          <span className="text-xs text-slate-500">
            Choose at least one asset, an investor type, and one content type.
          </span>
        )}
      </div>
    </form>
  );
}
