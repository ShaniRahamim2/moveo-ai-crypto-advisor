import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { prismaMock, resetPrismaMock } from './helpers/prismaMock.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/lib/jwt.js');

const app = createApp();
const auth = { Authorization: `Bearer ${signToken('user_1')}` };

const validBody = {
  selectedAssets: ['BTC', 'ETH'],
  investorType: 'HODLER',
  contentPreferences: ['MARKET_NEWS', 'CHARTS'],
};

const stored = { ...validBody, updatedAt: new Date('2026-08-07T10:00:00Z') };

beforeEach(() => {
  resetPrismaMock();
  // $transaction receives an array of prepared promises; return their results.
  prismaMock.$transaction = vi.fn(async (ops: unknown[]) => Promise.all(ops));
});

describe('GET /api/preferences', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/preferences');
    expect(res.status).toBe(401);
  });

  it('returns the stored preferences', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValue(stored);

    const res = await request(app).get('/api/preferences').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.preferences.selectedAssets).toEqual(['BTC', 'ETH']);
    expect(res.body.preferences.investorType).toBe('HODLER');
  });

  it('returns null before onboarding', async () => {
    prismaMock.userPreference.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/preferences').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.preferences).toBeNull();
  });
});

describe('GET /api/preferences/options', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/preferences/options')).status).toBe(401);
  });

  it('serves a real coin list with CoinGecko ids', async () => {
    const res = await request(app).get('/api/preferences/options').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.coins.length).toBeGreaterThanOrEqual(40);
    expect(res.body.coins[0]).toMatchObject({ symbol: 'BTC', coingeckoId: 'bitcoin' });
    expect(res.body.maxAssets).toBe(12);
    expect(res.body.contentPreferences.map((c: { value: string }) => c.value)).toEqual([
      'MARKET_NEWS',
      'CHARTS',
      'SOCIAL',
      'FUN',
    ]);
  });
});

describe('PUT /api/preferences', () => {
  it('requires authentication', async () => {
    const res = await request(app).put('/api/preferences').send(validBody);
    expect(res.status).toBe(401);
  });

  it('saves preferences and completes onboarding in one transaction', async () => {
    prismaMock.userPreference.upsert.mockResolvedValue(stored);
    prismaMock.user.update.mockResolvedValue({ id: 'user_1' });

    const res = await request(app).put('/api/preferences').set(auth).send(validBody);

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { onboardingCompleted: true } }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an asset outside the supported list', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, selectedAssets: ['BTC', 'NOTACOIN'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prismaMock.userPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects more than twelve assets', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({
        ...validBody,
        selectedAssets: [
          'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'LINK', 'AVAX', 'DOT', 'BCH', 'XLM', 'HBAR',
        ],
      });

    expect(res.status).toBe(400);
    expect(prismaMock.userPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects an empty asset selection', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, selectedAssets: [] });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate assets', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, selectedAssets: ['BTC', 'BTC'] });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown investor type', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, investorType: 'WHALE' });

    expect(res.status).toBe(400);
  });

  it('rejects an empty content preference list', async () => {
    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, contentPreferences: [] });

    expect(res.status).toBe(400);
  });

  it('accepts twelve assets', async () => {
    prismaMock.userPreference.upsert.mockResolvedValue(stored);
    prismaMock.user.update.mockResolvedValue({ id: 'user_1' });

    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({
        ...validBody,
        selectedAssets: [
          'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'TRX', 'LINK', 'AVAX', 'DOT', 'BCH', 'XLM',
        ],
      });

    expect(res.status).toBe(200);
  });

  it('accepts lowercase symbols and stores them uppercased', async () => {
    prismaMock.userPreference.upsert.mockResolvedValue(stored);
    prismaMock.user.update.mockResolvedValue({ id: 'user_1' });

    const res = await request(app)
      .put('/api/preferences')
      .set(auth)
      .send({ ...validBody, selectedAssets: ['btc', 'eth'] });

    expect(res.status).toBe(200);
    expect(prismaMock.userPreference.upsert.mock.calls[0]![0].create.selectedAssets).toEqual([
      'BTC',
      'ETH',
    ]);
  });
});
