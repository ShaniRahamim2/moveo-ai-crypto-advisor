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
