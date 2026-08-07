export type InvestorType = 'HODLER' | 'DAY_TRADER' | 'NFT_COLLECTOR';
export type ContentPreference = 'MARKET_NEWS' | 'CHARTS' | 'SOCIAL' | 'FUN';

export interface SupportedCoin {
  symbol: string;
  coingeckoId: string;
  name: string;
}

export interface OptionEntry<T extends string> {
  value: T;
  label: string;
  description: string;
}

export interface PreferenceOptions {
  coins: SupportedCoin[];
  maxAssets: number;
  investorTypes: OptionEntry<InvestorType>[];
  contentPreferences: OptionEntry<ContentPreference>[];
  starterMix: {
    selectedAssets: string[];
    investorType: InvestorType;
    contentPreferences: ContentPreference[];
  };
}

export interface Preferences {
  selectedAssets: string[];
  investorType: InvestorType;
  contentPreferences: ContentPreference[];
  updatedAt: string;
}
