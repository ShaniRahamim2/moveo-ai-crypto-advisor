interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small in-process TTL cache. Deliberately not Redis: one instance, short TTLs,
 * and the only cost of a cold cache is one extra upstream call.
 *
 * `getStale` exists because a rate-limited or failing provider is better served
 * by expired data, clearly labelled, than by an empty section.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) return undefined;
    return entry.value;
  }

  getStale(key: string): T | undefined {
    return this.entries.get(key)?.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
