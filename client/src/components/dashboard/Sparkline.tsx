interface SparklineProps {
  values: number[];
  positive: boolean;
}

// Hand-rolled rather than pulling in a charting library for one 40x16 line.
export function Sparkline({ values, positive }: SparklineProps) {
  if (values.length < 2) return null;

  const width = 64;
  const height = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Downsample: 168 hourly points into ~32 is plenty at this size.
  const step = Math.max(1, Math.floor(values.length / 32));
  const sampled = values.filter((_, i) => i % step === 0);

  const points = sampled
    .map((value, i) => {
      const x = (i / (sampled.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'var(--color-gain)' : 'var(--color-loss)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
