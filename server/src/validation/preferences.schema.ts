import { z } from 'zod';
import { isSupportedSymbol } from '../data/coins.js';

export const MAX_ASSETS = 8;

export const preferencesSchema = z.object({
  selectedAssets: z
    .array(z.string().trim().toUpperCase())
    .min(1, 'Choose at least one asset')
    .max(MAX_ASSETS, `Choose no more than ${MAX_ASSETS} assets`)
    .refine((assets) => new Set(assets).size === assets.length, 'Assets must be unique')
    // A symbol outside the supported list has no CoinGecko id, which would empty
    // the prices section without any visible error. Rejected at the boundary.
    .refine((assets) => assets.every(isSupportedSymbol), {
      message: 'One or more assets are not supported',
    }),
  investorType: z.enum(['HODLER', 'DAY_TRADER', 'NFT_COLLECTOR']),
  contentPreferences: z
    .array(z.enum(['MARKET_NEWS', 'CHARTS', 'SOCIAL', 'FUN']))
    .min(1, 'Choose at least one kind of content')
    .refine((prefs) => new Set(prefs).size === prefs.length, 'Preferences must be unique'),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
