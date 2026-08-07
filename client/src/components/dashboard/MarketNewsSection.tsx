import { relativeTime } from '../../dashboard/format';
import type { NewsItem } from '../../dashboard/types';

export function MarketNewsSection({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No recent headlines for your assets.</p>;
  }

  return (
    <ul className="divide-y divide-edge">
      {items.map((item) => (
        <li key={item.url} className="py-3 first:pt-0 last:pb-0">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block focus-visible:outline-none"
          >
            <p className="text-sm leading-snug text-slate-100 group-hover:text-white group-focus-visible:underline">
              {item.title}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>{item.source}</span>
              <span aria-hidden="true">·</span>
              <span>{relativeTime(item.publishedAt)}</span>
              {item.assets.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">{item.assets.slice(0, 3).join(', ')}</span>
                </>
              )}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
