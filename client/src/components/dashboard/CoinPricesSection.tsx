import { CoinLogo } from './CoinLogo';
import { Sparkline } from './Sparkline';
import { formatChange, formatPrice, relativeTime } from '../../dashboard/format';
import type { CoinPrice } from '../../dashboard/types';

interface CoinPricesSectionProps {
  prices: CoinPrice[];
  showSparklines: boolean;
}

export function CoinPricesSection({ prices, showSparklines }: CoinPricesSectionProps) {
  if (prices.length === 0) {
    return <p className="text-sm text-slate-500">No prices to show right now.</p>;
  }

  return (
    <ul className="divide-y divide-edge">
      {prices.map((coin) => {
        const positive = coin.change24hPercent >= 0;

        return (
          <li key={coin.symbol} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <CoinLogo symbol={coin.symbol} imageUrl={coin.imageUrl} />

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{coin.symbol}</p>
              <p className="truncate text-xs text-slate-500">{coin.name}</p>
            </div>

            {showSparklines && coin.sparkline7d && (
              <Sparkline values={coin.sparkline7d} positive={positive} />
            )}

            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-white sm:text-xl">
                {formatPrice(coin.price)}
              </p>
              <p
                className={`text-sm font-medium tabular-nums ${
                  positive ? 'text-gain' : 'text-loss'
                }`}
              >
                {formatChange(coin.change24hPercent)}
                <span className="sr-only"> in the last 24 hours</span>
              </p>
            </div>
          </li>
        );
      })}

      {prices[0] && (
        <li className="pt-3 text-xs text-slate-500">
          Updated {relativeTime(prices[0].lastUpdated)}
        </li>
      )}
    </ul>
  );
}
