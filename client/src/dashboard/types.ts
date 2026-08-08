import type { ContentPreference, InvestorType } from '../preferences/types';
import type { SectionType } from '../feedback/queries';

export type SectionStatus = 'ok' | 'fallback' | 'error';

export interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24hPercent: number;
  lastUpdated: string;
  imageUrl?: string;
  sparkline7d?: number[];
}

export interface NewsItem {
  title: string;
  summary?: string;
  url: string;
  source: string;
  publishedAt: string;
  assets: string[];
  socialScore?: number;
}

export interface Meme {
  id: string;
  imageUrl: string;
  altText: string;
}

export interface Insight {
  summary: string | null;
  text: string;
  disclaimer: string;
  generatedAt: string;
  model?: string;
  aiGenerated: boolean;
}

export interface DashboardSection<T = unknown> {
  type: SectionType;
  title: string;
  status: SectionStatus;
  contentRef: string;
  source: string;
  fetchedAt: string;
  notice?: string;
  data: T;
}

export interface MemeDeck {
  current: Meme;
  deck: Meme[];
  hiddenCount: number;
  totalCount: number;
  exhausted: boolean;
}

export interface Dashboard {
  generatedAt: string;
  order: SectionType[];
  hiddenCounts: { memes: number; articles: number };
  personalization: {
    selectedAssets: string[];
    investorType: InvestorType;
    contentPreferences: ContentPreference[];
    showSparklines: boolean;
  };
  sections: DashboardSection[];
}
