import { useMemo, useState } from 'react';
import type { SupportedCoin } from '../preferences/types';

interface AssetPickerProps {
  coins: SupportedCoin[];
  selected: string[];
  maxAssets: number;
  onChange: (next: string[]) => void;
}

export function AssetPicker({ coins, selected, maxAssets, onChange }: AssetPickerProps) {
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      : coins;
    return pool.slice(0, 24);
  }, [coins, query]);

  const atLimit = selected.length >= maxAssets;

  function toggle(symbol: string) {
    if (selected.includes(symbol)) {
      onChange(selected.filter((s) => s !== symbol));
    } else if (!atLimit) {
      onChange([...selected, symbol]);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected assets">
          {selected.map((symbol) => (
            <li key={symbol}>
              <button
                type="button"
                onClick={() => toggle(symbol)}
                className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm text-accent hover:bg-accent/25"
                aria-label={`Remove ${symbol}`}
              >
                {symbol}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or symbol"
        aria-label="Search assets"
        className="rounded-md border border-edge bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
      />

      <div className="max-h-56 overflow-y-auto rounded-md border border-edge">
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">No asset matches “{query}”.</p>
        ) : (
          <ul>
            {matches.map((coin) => {
              const isSelected = selected.includes(coin.symbol);
              return (
                <li key={coin.symbol}>
                  <button
                    type="button"
                    onClick={() => toggle(coin.symbol)}
                    aria-pressed={isSelected}
                    disabled={!isSelected && atLimit}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="truncate">
                      <span className="font-medium text-slate-200">{coin.symbol}</span>
                      <span className="ml-2 text-slate-500">{coin.name}</span>
                    </span>
                    {isSelected && <span className="text-accent">selected</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {selected.length} of {maxAssets} selected.{' '}
        {atLimit ? 'Remove one to add another.' : 'Three to five works well.'}
      </p>
    </div>
  );
}
