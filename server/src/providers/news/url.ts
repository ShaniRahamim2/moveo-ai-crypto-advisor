/**
 * A news link is external input and lands in an `href` in the browser, so a
 * `javascript:` or `data:` URL from a hostile or compromised feed would run in
 * our origin — where the token is. Every tier is covered: RSS parses whatever
 * `<link>` contains, and CryptoPanic hands back `original_url` from a third
 * party. Applied where the items converge rather than in each provider, so a
 * future source cannot forget it.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
