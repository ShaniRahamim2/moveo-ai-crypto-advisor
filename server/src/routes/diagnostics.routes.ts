import { Router } from 'express';

// TEMPORARY. Exists only to determine, from the deployed backend's own network
// origin, whether CryptoPanic is reachable at all. Removed once the NewsProvider
// tier order is settled.
export const diagnosticsRouter = Router();

const PLANS = ['developer', 'free', 'basic', 'pro'];

async function probe(url: string) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'moveo-crypto-advisor/1.0' },
    });
    const body = await res.text();
    let shape: unknown = null;
    try {
      const parsed = JSON.parse(body) as { results?: unknown[] };
      shape = {
        keys: Object.keys(parsed),
        count: Array.isArray(parsed.results) ? parsed.results.length : null,
        firstItemKeys: Array.isArray(parsed.results)
          ? Object.keys((parsed.results[0] ?? {}) as object)
          : null,
        firstItem: Array.isArray(parsed.results) ? parsed.results[0] : null,
      };
    } catch {
      shape = { notJson: body.slice(0, 160) };
    }

    return { status: res.status, ms: Date.now() - started, shape };
  } catch (err) {
    return { status: 'error', ms: Date.now() - started, message: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

diagnosticsRouter.get('/news', async (_req, res) => {
  const token = process.env.CRYPTOPANIC_AUTH_TOKEN ?? '';
  if (!token) {
    res.json({ error: 'CRYPTOPANIC_AUTH_TOKEN is not set on this instance' });
    return;
  }

  const targets: Record<string, string> = {
    v1: `https://cryptopanic.com/api/v1/posts/?auth_token=${token}&currencies=BTC,ETH`,
  };
  for (const plan of PLANS) {
    targets[`${plan}-v2`] =
      `https://cryptopanic.com/api/${plan}/v2/posts/?auth_token=${token}&currencies=BTC,ETH`;
  }

  const entries = await Promise.all(
    Object.entries(targets).map(async ([name, url]) => [name, await probe(url)] as const),
  );

  res.json(Object.fromEntries(entries));
});

const RSS_FEEDS: Record<string, string> = {
  cointelegraph: 'https://cointelegraph.com/rss',
  decrypt: 'https://decrypt.co/feed',
  cryptoslate: 'https://cryptoslate.com/feed/',
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss',
};

diagnosticsRouter.get('/rss', async (_req, res) => {
  const entries = await Promise.all(
    Object.entries(RSS_FEEDS).map(async ([name, url]) => {
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: { Accept: 'application/rss+xml,application/xml', 'User-Agent': 'moveo-crypto-advisor/1.0' },
        });
        const body = await response.text();
        return [
          name,
          {
            status: response.status,
            ms: Date.now() - started,
            items: (body.match(/<item[\s>]/g) ?? []).length,
            looksLikeRss: body.includes('<rss') || body.includes('<feed'),
          },
        ] as const;
      } catch (err) {
        return [name, { status: 'error', ms: Date.now() - started, message: (err as Error).message }] as const;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  res.json(Object.fromEntries(entries));
});
