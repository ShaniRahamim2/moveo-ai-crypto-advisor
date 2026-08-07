import { fetchJson } from '../../lib/httpClient.js';
import type { PersonalizationContext } from '../../services/personalization.js';
import type { NewsItem } from '../types.js';

const TIMEOUT_MS = 5000;

interface CryptoPanicPost {
  title: string;
  url?: string;
  original_url?: string;
  published_at: string;
  source?: { title?: string; domain?: string };
  instruments?: { code: string }[];
  votes?: { positive?: number; important?: number; liked?: number; negative?: number };
  panic_score?: number;
}

/**
 * Tier 1. The only source that carries a community signal, which is what the
 * Social content preference needs.
 *
 * As of this build CryptoPanic is unreachable from both a residential IP and the
 * deployed backend: the v1 path returns a Cloudflare bot-detection challenge and
 * every documented v2 plan segment returns 404. The provider is kept because it
 * is correct if access is restored, and the layered provider simply moves to the
 * next tier while it fails.
 */
export class CryptoPanicProvider {
  readonly name = 'cryptopanic';

  constructor(
    private readonly token = process.env.CRYPTOPANIC_AUTH_TOKEN ?? '',
    private readonly plan = process.env.CRYPTOPANIC_PLAN ?? 'developer',
  ) {}

  get configured(): boolean {
    return this.token.length > 0;
  }

  async getNews(context: PersonalizationContext): Promise<NewsItem[]> {
    if (!this.configured) {
      throw new Error('CryptoPanic token is not configured');
    }

    const url =
      `https://cryptopanic.com/api/${this.plan}/v2/posts/` +
      `?auth_token=${encodeURIComponent(this.token)}` +
      `&currencies=${encodeURIComponent(context.selectedAssets.join(','))}` +
      `&public=true`;

    const body = await fetchJson<{ results?: CryptoPanicPost[] }>(url, { timeoutMs: TIMEOUT_MS });

    return (body.results ?? []).map((post) => {
      const votes = post.votes ?? {};
      const positive = (votes.positive ?? 0) + (votes.important ?? 0) + (votes.liked ?? 0);

      return {
        title: post.title,
        url: post.original_url ?? post.url ?? '',
        source: post.source?.title ?? post.source?.domain ?? 'CryptoPanic',
        publishedAt: post.published_at,
        assets: (post.instruments ?? []).map((i) => i.code.toUpperCase()),
        socialScore: post.panic_score ?? positive,
      };
    });
  }
}
