import type { ContentPreference, InvestorType } from '@prisma/client';

export interface InsightInput {
  assets: string[];
  investorType: InvestorType;
  framing: string;
  contentFocus: ContentPreference[];
  prices: { symbol: string; price: number; change24hPercent: number }[];
  headlines: { title: string; source: string }[];
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateInsight(input: InsightInput): Promise<string>;
}
