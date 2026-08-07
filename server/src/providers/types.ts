import type { PersonalizationContext } from '../services/personalization.js';

export type SectionStatus = 'ok' | 'fallback' | 'error';

export interface ProviderResult<T> {
  status: SectionStatus;
  data: T;
  /** Which tier or upstream actually served this, for the UI and the reviewer. */
  source: string;
  fetchedAt: string;
  /** Plain-language explanation shown to the user when status is not 'ok'. */
  notice?: string;
}

export interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24hPercent: number;
  lastUpdated: string;
  /** Present only when the user selected the Charts content preference. */
  sparkline7d?: number[];
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  assets: string[];
  /** Community signal, only available from providers that expose it. */
  socialScore?: number;
}

export interface Meme {
  id: string;
  /** Path under the frontend's own origin, e.g. /memes/meme-001.svg */
  imageUrl: string;
  caption: string;
  subcaption: string;
  altText: string;
}

export interface MarketDataProvider {
  readonly name: string;
  getPrices(context: PersonalizationContext): Promise<ProviderResult<CoinPrice[]>>;
}

export interface NewsProvider {
  readonly name: string;
  getNews(context: PersonalizationContext): Promise<ProviderResult<NewsItem[]>>;
}

export interface MemeProvider {
  readonly name: string;
  getMeme(previousId?: string): Promise<ProviderResult<Meme>>;
}
