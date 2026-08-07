import type { NextFunction, Request, Response } from 'express';
import * as preferencesService from '../services/preferences.service.js';
import { getUserId } from '../middleware/requireAuth.js';
import { SUPPORTED_COINS } from '../data/coins.js';
import { MAX_ASSETS, type PreferencesInput } from '../validation/preferences.schema.js';

export async function getPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ preferences: await preferencesService.getPreferences(getUserId(req)) });
  } catch (err) {
    next(err);
  }
}

export async function savePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const preferences = await preferencesService.savePreferences(
      getUserId(req),
      req.body as PreferencesInput,
    );
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
}

// The picker is built from this list so a user can only ever submit a symbol
// that resolves to a real CoinGecko id.
export function getOptions(_req: Request, res: Response) {
  res.json({
    coins: SUPPORTED_COINS,
    maxAssets: MAX_ASSETS,
    investorTypes: [
      {
        value: 'HODLER',
        label: 'HODLer',
        description: 'You buy and hold for the long term.',
      },
      {
        value: 'DAY_TRADER',
        label: 'Day Trader',
        description: 'You watch short-term moves.',
      },
      {
        value: 'NFT_COLLECTOR',
        label: 'NFT Collector',
        description: 'You follow collections and on-chain activity.',
      },
    ],
    contentPreferences: [
      {
        value: 'MARKET_NEWS',
        label: 'Market News',
        description: 'Recent headlines about the coins you picked.',
      },
      {
        value: 'CHARTS',
        label: 'Charts',
        description: 'A 7-day price trend line on each coin.',
      },
      {
        value: 'SOCIAL',
        label: 'Social',
        description: 'What the community is reacting to.',
      },
      { value: 'FUN', label: 'Fun', description: 'A crypto meme with your briefing.' },
    ],
    // Offered to anyone who does not yet know what to pick. Fully editable
    // before submitting — it fills the form in, it does not skip it.
    starterMix: {
      selectedAssets: ['BTC', 'ETH', 'SOL'],
      investorType: 'HODLER',
      contentPreferences: ['MARKET_NEWS'],
    },
  });
}
