import { useState } from 'react';

interface CoinLogoProps {
  symbol: string;
  imageUrl?: string;
}

/**
 * Degrades to the symbol on a failed load. A broken-image icon would make the
 * section look broken because of a third-party CDN hiccup.
 */
export function CoinLogo({ symbol, imageUrl }: CoinLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-edge text-[10px] font-semibold text-slate-300"
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      aria-hidden="true"
      loading="lazy"
      width={28}
      height={28}
      onError={() => setFailed(true)}
      className="h-7 w-7 shrink-0 rounded-full"
    />
  );
}
