import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { prismaMock, resetPrismaMock } from './helpers/prismaMock.js';

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));

const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/lib/jwt.js');
const { newsRef, pricesRef, memeRef, insightRef, refFor } = await import(
  '../src/services/contentRef.js'
);

const app = createApp();
const auth = { Authorization: `Bearer ${signToken('user_1')}` };

const upVote = {
  sectionType: 'COIN_PRICES',
  contentRef: 'prices:BTC,ETH',
  vote: 'UP',
};

beforeEach(() => {
  resetPrismaMock();
  prismaMock.userPreference.findUnique.mockResolvedValue({
    selectedAssets: ['BTC', 'ETH'],
    investorType: 'HODLER',
    contentPreferences: ['MARKET_NEWS'],
    updatedAt: new Date(),
  });
});

describe('POST /api/feedback', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/feedback').send(upVote);
    expect(res.status).toBe(401);
  });

  it('records an UP vote', async () => {
    prismaMock.feedback.upsert.mockResolvedValue({ ...upVote, updatedAt: new Date() });

    const res = await request(app).post('/api/feedback').set(auth).send(upVote);

    expect(res.status).toBe(200);
    expect(res.body.feedback.vote).toBe('UP');
    expect(prismaMock.feedback.upsert).toHaveBeenCalledTimes(1);
  });

  it('changes an existing vote by upserting rather than inserting', async () => {
    prismaMock.feedback.upsert.mockResolvedValue({
      ...upVote,
      vote: 'DOWN',
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/feedback')
      .set(auth)
      .send({ ...upVote, vote: 'DOWN' });

    expect(res.status).toBe(200);
    expect(res.body.feedback.vote).toBe('DOWN');

    const call = prismaMock.feedback.upsert.mock.calls[0]![0];
    expect(call.where.userId_sectionType_contentRef).toEqual({
      userId: 'user_1',
      sectionType: 'COIN_PRICES',
      contentRef: 'prices:BTC,ETH',
    });
    expect(call.update.vote).toBe('DOWN');
    expect(prismaMock.feedback.create).toBeUndefined();
  });

  it('keys the upsert on the authenticated user, not anything from the body', async () => {
    prismaMock.feedback.upsert.mockResolvedValue({ ...upVote, updatedAt: new Date() });

    await request(app)
      .post('/api/feedback')
      .set(auth)
      .send({ ...upVote, userId: 'someone_else' });

    const call = prismaMock.feedback.upsert.mock.calls[0]![0];
    expect(call.where.userId_sectionType_contentRef.userId).toBe('user_1');
    expect(call.create.userId).toBe('user_1');
  });

  it('snapshots the personalization context server-side', async () => {
    prismaMock.feedback.upsert.mockResolvedValue({ ...upVote, updatedAt: new Date() });

    await request(app).post('/api/feedback').set(auth).send(upVote);

    const call = prismaMock.feedback.upsert.mock.calls[0]![0];
    expect(call.create.context).toEqual({
      selectedAssets: ['BTC', 'ETH'],
      investorType: 'HODLER',
      contentPreferences: ['MARKET_NEWS'],
    });
  });

  it('rejects an invalid section type', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set(auth)
      .send({ ...upVote, sectionType: 'HOROSCOPE' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(prismaMock.feedback.upsert).not.toHaveBeenCalled();
  });

  it('rejects an invalid vote value', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set(auth)
      .send({ ...upVote, vote: 'MAYBE' });

    expect(res.status).toBe(400);
    expect(prismaMock.feedback.upsert).not.toHaveBeenCalled();
  });

  it('rejects an empty content reference', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set(auth)
      .send({ ...upVote, contentRef: '   ' });

    expect(res.status).toBe(400);
  });

  it('accepts a vote on every section type', async () => {
    prismaMock.feedback.upsert.mockResolvedValue({ ...upVote, updatedAt: new Date() });

    for (const sectionType of ['MARKET_NEWS', 'COIN_PRICES', 'AI_INSIGHT', 'MEME']) {
      const res = await request(app)
        .post('/api/feedback')
        .set(auth)
        .send({ sectionType, contentRef: `ref-${sectionType}`, vote: 'UP' });

      expect(res.status).toBe(200);
    }
  });
});

describe('GET /api/feedback', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/feedback')).status).toBe(401);
  });

  it('returns stored votes so the UI can restore them after a refresh', async () => {
    prismaMock.feedback.findMany.mockResolvedValue([
      { sectionType: 'COIN_PRICES', contentRef: 'prices:BTC,ETH', vote: 'UP', updatedAt: new Date() },
      { sectionType: 'MEME', contentRef: 'meme:meme-003', vote: 'DOWN', updatedAt: new Date() },
    ]);

    const res = await request(app).get('/api/feedback').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.feedback).toHaveLength(2);
    expect(res.body.feedback[0].vote).toBe('UP');
  });

  it('scopes the query to the authenticated user', async () => {
    prismaMock.feedback.findMany.mockResolvedValue([]);

    await request(app).get('/api/feedback').set(auth);

    expect(prismaMock.feedback.findMany.mock.calls[0]![0].where).toEqual({ userId: 'user_1' });
  });
});

describe('content references', () => {
  const meme = {
    id: 'meme-003',
    imageUrl: '/memes/meme-003.svg',
    caption: 'c',
    subcaption: 's',
    altText: 'a',
  };

  it('is stable regardless of the order the same content arrives in', () => {
    expect(pricesRef(['ETH', 'BTC'])).toBe(pricesRef(['BTC', 'ETH']));

    const a = [{ url: 'https://a' }, { url: 'https://b' }] as never;
    const b = [{ url: 'https://b' }, { url: 'https://a' }] as never;
    expect(newsRef(a)).toBe(newsRef(b));
  });

  it('changes when the content changes', () => {
    expect(pricesRef(['BTC'])).not.toBe(pricesRef(['BTC', 'ETH']));
    expect(newsRef([{ url: 'https://a' }] as never)).not.toBe(
      newsRef([{ url: 'https://c' }] as never),
    );
    expect(memeRef(meme)).not.toBe(memeRef({ ...meme, id: 'meme-004' }));
  });

  it('namespaces each section so refs cannot collide', () => {
    expect(pricesRef(['BTC'])).toMatch(/^prices:/);
    expect(newsRef([])).toMatch(/^news:/);
    expect(insightRef('abc123')).toMatch(/^insight:/);
    expect(memeRef(meme)).toMatch(/^meme:/);
  });

  it('routes each section type to its own reference builder', () => {
    expect(refFor('MEME', { meme })).toBe('meme:meme-003');
    expect(refFor('COIN_PRICES', { prices: [{ symbol: 'BTC' }] as never })).toBe('prices:BTC');
    expect(refFor('AI_INSIGHT', { contextHash: 'deadbeef' })).toBe('insight:deadbeef');
    expect(refFor('MARKET_NEWS', { news: [] })).toBe('news:empty');
  });
});
