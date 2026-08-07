import type { SectionType } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { CoinGeckoProvider } from '../providers/market/coingecko.provider.js';
import { LayeredNewsProvider } from '../providers/news/index.js';
import { StaticMemeProvider } from '../providers/meme/meme.provider.js';
import type {
  CoinPrice,
  MarketDataProvider,
  Meme,
  MemeProvider,
  NewsItem,
  NewsProvider,
  ProviderResult,
  SectionStatus,
} from '../providers/types.js';
import { InsightService, buildContextHash, type Insight } from './insight.service.js';
import { getPersonalizationContext } from './preferences.service.js';
import { refFor } from './contentRef.js';
import type { PersonalizationContext } from './personalization.js';

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

export interface Dashboard {
  generatedAt: string;
  order: SectionType[];
  personalization: {
    selectedAssets: string[];
    investorType: PersonalizationContext['investorType'];
    contentPreferences: PersonalizationContext['contentPreferences'];
    showSparklines: boolean;
  };
  sections: DashboardSection[];
}

const TITLES: Record<SectionType, string> = {
  MARKET_NEWS: 'Market News',
  COIN_PRICES: 'Coin Prices',
  AI_INSIGHT: 'AI Insight of the Day',
  MEME: 'Fun Crypto Meme',
};

/**
 * A provider that throws instead of returning a degraded result would otherwise
 * reject the whole request. This is the last line of defence for the rule that
 * one dead section never takes the dashboard down.
 */
async function settle<T>(
  section: SectionType,
  fallback: T,
  run: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  try {
    return await run();
  } catch (err) {
    logger.error('section_provider_threw', {
      section,
      detail: (err as Error).message.slice(0, 160),
    });
    return {
      status: 'error',
      data: fallback,
      source: 'none',
      fetchedAt: new Date().toISOString(),
      notice: 'This section could not be loaded. Refresh to try again.',
    };
  }
}

export class DashboardService {
  constructor(
    private readonly market: MarketDataProvider = new CoinGeckoProvider(),
    private readonly news: NewsProvider = new LayeredNewsProvider(),
    private readonly meme: MemeProvider = new StaticMemeProvider(),
    private readonly insight = new InsightService(),
  ) {}

  async build(userId: string, previousMemeId?: string): Promise<Dashboard> {
    const context = await getPersonalizationContext(userId);

    // Independent sections run concurrently; the insight needs their output.
    const [prices, news, meme] = await Promise.all([
      settle<CoinPrice[]>('COIN_PRICES', [], () => this.market.getPrices(context)),
      settle<NewsItem[]>('MARKET_NEWS', [], () => this.news.getNews(context)),
      settle<Meme>(
        'MEME',
        { id: 'none', imageUrl: '', caption: '', subcaption: '', altText: '' },
        () => this.meme.getMeme(previousMemeId),
      ),
    ]);

    const insight = await settle<Insight>(
      'AI_INSIGHT',
      {
        text: 'The daily insight is unavailable right now.',
        disclaimer: 'AI-generated insight for informational purposes only. Not financial advice.',
        generatedAt: new Date().toISOString(),
        aiGenerated: false,
      },
      () => this.insight.getInsight(context, prices.data, news.data),
    );

    const contextHash = buildContextHash(context);

    const byType: Record<SectionType, DashboardSection> = {
      COIN_PRICES: this.toSection('COIN_PRICES', prices, refFor('COIN_PRICES', { prices: prices.data })),
      MARKET_NEWS: this.toSection('MARKET_NEWS', news, refFor('MARKET_NEWS', { news: news.data })),
      AI_INSIGHT: this.toSection('AI_INSIGHT', insight, refFor('AI_INSIGHT', { contextHash })),
      MEME: this.toSection('MEME', meme, refFor('MEME', { meme: meme.data })),
    };

    return {
      generatedAt: new Date().toISOString(),
      order: context.sectionOrder,
      personalization: {
        selectedAssets: context.selectedAssets,
        investorType: context.investorType,
        contentPreferences: context.contentPreferences,
        showSparklines: context.includeSparklines,
      },
      // All four always render; preferences change the order, never the presence.
      sections: context.sectionOrder.map((type) => byType[type]),
    };
  }

  private toSection<T>(
    type: SectionType,
    result: ProviderResult<T>,
    contentRef: string,
  ): DashboardSection<T> {
    return {
      type,
      title: TITLES[type],
      status: result.status,
      contentRef,
      source: result.source,
      fetchedAt: result.fetchedAt,
      ...(result.notice ? { notice: result.notice } : {}),
      data: result.data,
    };
  }
}
