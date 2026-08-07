// Generated from CoinGecko's top coins by market cap. The CoinGecko id is stored
// explicitly rather than derived at runtime: a symbol that does not resolve to a
// real id silently empties the prices section, so the mapping is checked in.
export interface SupportedCoin {
  symbol: string;
  coingeckoId: string;
  name: string;
}

export const SUPPORTED_COINS: SupportedCoin[] = [
  { symbol: 'BTC', coingeckoId: 'bitcoin', name: 'Bitcoin' },
  { symbol: 'ETH', coingeckoId: 'ethereum', name: 'Ethereum' },
  { symbol: 'BNB', coingeckoId: 'binancecoin', name: 'BNB' },
  { symbol: 'XRP', coingeckoId: 'ripple', name: 'XRP' },
  { symbol: 'SOL', coingeckoId: 'solana', name: 'Solana' },
  { symbol: 'TRX', coingeckoId: 'tron', name: 'TRON' },
  { symbol: 'FIGR_HELOC', coingeckoId: 'figure-heloc', name: 'Figure Heloc' },
  { symbol: 'HYPE', coingeckoId: 'hyperliquid', name: 'Hyperliquid' },
  { symbol: 'DOGE', coingeckoId: 'dogecoin', name: 'Dogecoin' },
  { symbol: 'RAIN', coingeckoId: 'rain', name: 'Rain' },
  { symbol: 'LEO', coingeckoId: 'leo-token', name: 'LEO Token' },
  { symbol: 'ZEC', coingeckoId: 'zcash', name: 'Zcash' },
  { symbol: 'ADA', coingeckoId: 'cardano', name: 'Cardano' },
  { symbol: 'XMR', coingeckoId: 'monero', name: 'Monero' },
  { symbol: 'WBT', coingeckoId: 'whitebit', name: 'WhiteBIT Coin' },
  { symbol: 'LINK', coingeckoId: 'chainlink', name: 'Chainlink' },
  { symbol: 'XLM', coingeckoId: 'stellar', name: 'Stellar' },
  { symbol: 'BCH', coingeckoId: 'bitcoin-cash', name: 'Bitcoin Cash' },
  { symbol: 'USD1', coingeckoId: 'usd1-wlfi', name: 'USD1' },
  { symbol: 'GRAM', coingeckoId: 'the-open-network', name: 'Gram (prev. Toncoin)' },
  { symbol: 'LTC', coingeckoId: 'litecoin', name: 'Litecoin' },
  { symbol: 'CC', coingeckoId: 'canton-network', name: 'Canton' },
  { symbol: 'USDG', coingeckoId: 'global-dollar', name: 'Global Dollar' },
  { symbol: 'USYC', coingeckoId: 'hashnote-usyc', name: 'Circle USYC' },
  { symbol: 'HBAR', coingeckoId: 'hedera-hashgraph', name: 'Hedera' },
  { symbol: 'AVAX', coingeckoId: 'avalanche-2', name: 'Avalanche' },
  { symbol: 'SUI', coingeckoId: 'sui', name: 'Sui' },
  { symbol: 'SHIB', coingeckoId: 'shiba-inu', name: 'Shiba Inu' },
  { symbol: 'XAUT', coingeckoId: 'tether-gold', name: 'Tether Gold' },
  { symbol: 'UNI', coingeckoId: 'uniswap', name: 'Uniswap' },
  { symbol: 'CRO', coingeckoId: 'crypto-com-chain', name: 'Cronos' },
  { symbol: 'USDY', coingeckoId: 'ondo-us-dollar-yield', name: 'Ondo US Dollar Yield' },
  { symbol: 'NEAR', coingeckoId: 'near', name: 'NEAR Protocol' },
  { symbol: 'PAXG', coingeckoId: 'pax-gold', name: 'PAX Gold' },
  { symbol: 'TAO', coingeckoId: 'bittensor', name: 'Bittensor' },
  { symbol: 'OKB', coingeckoId: 'okb', name: 'OKB' },
  { symbol: 'ONDO', coingeckoId: 'ondo-finance', name: 'Ondo' },
  { symbol: 'WLFI', coingeckoId: 'world-liberty-financial', name: 'World Liberty Financial' },
  { symbol: 'HTX', coingeckoId: 'htx-dao', name: 'HTX DAO' },
  { symbol: 'ASTER', coingeckoId: 'aster-2', name: 'Aster' },
  { symbol: 'RLUSD', coingeckoId: 'ripple-usd', name: 'Ripple USD' },
  { symbol: 'USDD', coingeckoId: 'usdd', name: 'USDD' },
  { symbol: 'M', coingeckoId: 'memecore', name: 'MemeCore' },
  { symbol: 'USDF', coingeckoId: 'falcon-finance', name: 'Falcon USD' },
  { symbol: 'AAVE', coingeckoId: 'aave', name: 'Aave' },
  { symbol: 'DOT', coingeckoId: 'polkadot', name: 'Polkadot' },
  { symbol: 'MNT', coingeckoId: 'mantle', name: 'Mantle' },
  { symbol: 'BFUSD', coingeckoId: 'bfusd', name: 'BFUSD' },
  { symbol: 'SKY', coingeckoId: 'sky', name: 'Sky' },
  { symbol: 'MORPHO', coingeckoId: 'morpho', name: 'Morpho' },
];

export const SUPPORTED_SYMBOLS = SUPPORTED_COINS.map((c) => c.symbol);

const BY_SYMBOL = new Map(SUPPORTED_COINS.map((c) => [c.symbol, c]));

export function isSupportedSymbol(symbol: string): boolean {
  return BY_SYMBOL.has(symbol.toUpperCase());
}

export function toCoingeckoIds(symbols: string[]): string[] {
  return symbols
    .map((s) => BY_SYMBOL.get(s.toUpperCase())?.coingeckoId)
    .filter((id): id is string => Boolean(id));
}

export function findCoin(symbol: string): SupportedCoin | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}
