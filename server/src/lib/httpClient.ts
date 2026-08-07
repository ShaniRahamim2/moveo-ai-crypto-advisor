export type ProviderErrorKind =
  | 'timeout'
  | 'rate_limited'
  | 'http_error'
  | 'network_error'
  | 'parse_error';

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface FetchOptions {
  timeoutMs: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  method?: 'GET' | 'POST';
  body?: string;
}

/**
 * Every outbound call goes through here so that timeouts are always enforced and
 * failures are always classified. A 429 is distinguished from other HTTP errors
 * because it must never be retried immediately — the caller serves cache or a
 * fallback instead.
 */
export async function fetchWithTimeout(url: string, options: FetchOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      method: options.method ?? 'GET',
      ...(options.body ? { body: options.body } : {}),
      headers: { 'User-Agent': 'moveo-crypto-advisor/1.0', ...options.headers },
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new ProviderError('timeout', `Request exceeded ${options.timeoutMs}ms`);
    }
    throw new ProviderError('network_error', (err as Error).message);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new ProviderError('rate_limited', 'Upstream rate limit reached', 429);
  }

  if (!response.ok) {
    throw new ProviderError('http_error', `Upstream returned ${response.status}`, response.status);
  }

  return response;
}

export async function fetchJson<T>(url: string, options: FetchOptions): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });

  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError('parse_error', 'Upstream returned a malformed JSON body');
  }
}

export async function fetchText(url: string, options: FetchOptions): Promise<string> {
  return (await fetchWithTimeout(url, options)).text();
}
