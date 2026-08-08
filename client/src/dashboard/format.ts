export function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

export function formatChange(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);

  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
