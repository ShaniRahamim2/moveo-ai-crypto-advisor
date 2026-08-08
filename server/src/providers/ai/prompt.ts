import type { InsightInput } from './types.js';

function formatPrice(value: number): string {
  return value >= 1 ? `$${value.toLocaleString('en-US')}` : `$${value.toPrecision(3)}`;
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export const SYSTEM_PROMPT = [
  'You write a short daily briefing for a crypto dashboard.',
  'Reply with a single JSON object and nothing else, no code fences:',
  '{"summary": "...", "insight": "..."}.',
  'summary is ONE sentence of at most 20 words capturing the single most important point.',
  'insight is the full briefing.',
  'Use only the figures and headlines supplied. Never invent a number, a price or an event.',
  'Never give buy, sell or hold advice, and never predict a price.',
  'Explain what the supplied data means in plain language.',
  'Do not open with filler such as "In the ever-evolving world of cryptocurrency".',
  'Do not use markdown, headings, bullet points or emoji. Plain prose only.',
  'Write the insight as 60 to 110 words, two short paragraphs at most.',
].join(' ');

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pulls a field out of a JSON-ish payload without parsing it. The closing quote
 * is optional because the most common malformation is a reply truncated by the
 * token limit, which leaves the last string unterminated.
 */
function extractField(text: string, field: string): string | null {
  const match = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`, 'i').exec(text);
  const value = match?.[1] ? unescapeJsonString(match[1]) : '';
  return value || null;
}

/**
 * Last resort. Removes JSON punctuation and field names so that whatever prose
 * the model produced can still be shown. Braces and quoted keys must never
 * reach the screen — this section is the centrepiece of the product, and debug
 * output there is worse than a plain paragraph.
 */
function stripJsonScaffolding(text: string): string {
  return unescapeJsonString(
    text
      .replace(/^[\s{[]+/, '')
      .replace(/[\s}\]]+$/, '')
      .replace(/"(?:summary|insight|text)"\s*:\s*/gi, '')
      .replace(/"\s*,\s*"/g, ' ')
      .replace(/^"|"$/g, ''),
  ).replace(/^[,\s]+|[,\s]+$/g, '');
}

export interface ParsedInsight {
  summary: string | null;
  insight: string;
}

/**
 * The model is asked for JSON and does not reliably produce it — replies get
 * truncated by the token limit, wrapped in code fences, or given trailing
 * commas. Every path here ends in readable prose.
 */
export function parseInsightResponse(raw: string): ParsedInsight {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const start = cleaned.indexOf('{');
  const candidate = start === -1 ? cleaned : cleaned.slice(start);

  // 1. Straight parse, plus a repair for trailing commas.
  for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
    const end = attempt.lastIndexOf('}');
    if (end <= 0) continue;
    try {
      const parsed = JSON.parse(attempt.slice(0, end + 1)) as Record<string, unknown>;
      const insight = typeof parsed.insight === 'string' ? parsed.insight.trim() : '';
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      if (insight) return { summary: summary || null, insight };
    } catch {
      // Falls through to field extraction.
    }
  }

  // 2. Field extraction, which survives a truncated reply.
  const insight = extractField(candidate, 'insight');
  const summary = extractField(candidate, 'summary');
  if (insight) return { summary, insight };

  // 3. Nothing structured left; show the prose with the scaffolding removed.
  const stripped = stripJsonScaffolding(candidate);
  return { summary: null, insight: stripped || cleaned.replace(/[{}"]/g, '').trim() };
}

/**
 * The prompt carries preference data and market data only. No email, no user id,
 * no token — see the personalization context, which is built the same way.
 */
export function buildInsightPrompt(input: InsightInput): string {
  const prices = input.prices
    .map((p) => `${p.symbol} ${formatPrice(p.price)} (${signed(p.change24hPercent)} 24h)`)
    .join('; ');

  const headlines = input.headlines
    .slice(0, 5)
    .map((h, i) => `${i + 1}. "${h.title}" — ${h.source}`)
    .join('\n');

  return [
    `Reader profile: ${input.investorType.replace('_', ' ').toLowerCase()}.`,
    `Framing: ${input.framing}`,
    '',
    `Prices right now: ${prices || 'unavailable'}`,
    '',
    headlines ? `Recent headlines:\n${headlines}` : 'No headlines available.',
    '',
    'Write the briefing. You must reference at least one specific figure or headline',
    'from the data above, quoted accurately. If a figure is not above, do not mention it.',
  ].join('\n');
}

const MAX_WORDS = 120;

/**
 * The prompt asks for 60–110 words and the model does not reliably comply — one
 * live response came back at 174, which fills a phone screen on its own. The
 * limit is therefore enforced here rather than requested, trimming at a sentence
 * boundary so the text never ends mid-thought.
 */
export function clampInsight(text: string, maxWords = MAX_WORDS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.split(' ').length <= maxWords) return clean;

  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  const kept: string[] = [];
  let words = 0;

  for (const sentence of sentences) {
    const count = sentence.trim().split(/\s+/).length;
    if (words + count > maxWords && kept.length > 0) break;
    kept.push(sentence.trim());
    words += count;
  }

  // A single opening sentence longer than the cap still has to be cut somewhere.
  if (kept.length === 1 && words > maxWords) {
    return `${kept[0]!.split(/\s+/).slice(0, maxWords).join(' ')}…`;
  }

  return kept.join(' ');
}

/**
 * Used when the model is unavailable. Assembled from the same real market data
 * the page is already showing, and labelled in the UI as generated without AI —
 * it must never be mistaken for a model-written insight.
 */
export function buildFallbackInsight(input: InsightInput): string {
  if (input.prices.length === 0 && input.headlines.length === 0) {
    return 'Market data is unavailable right now, so there is no summary to show. Refresh in a moment to try again.';
  }

  const parts: string[] = [];

  if (input.prices.length > 0) {
    const movers = [...input.prices].sort(
      (a, b) => Math.abs(b.change24hPercent) - Math.abs(a.change24hPercent),
    );
    const lead = movers[0]!;
    const direction = lead.change24hPercent >= 0 ? 'up' : 'down';

    parts.push(
      `Across your assets, ${lead.symbol} shows the largest 24-hour move at ${signed(lead.change24hPercent)}, ` +
        `trading around ${formatPrice(lead.price)}.`,
    );

    if (movers.length > 1) {
      const rest = movers
        .slice(1, 4)
        .map((p) => `${p.symbol} ${signed(p.change24hPercent)}`)
        .join(', ');
      parts.push(`Alongside it: ${rest}. Direction is ${direction} on the largest mover.`);
    }
  }

  const headline = input.headlines[0];
  if (headline) {
    parts.push(`The most recent headline in your feed is "${headline.title}" (${headline.source}).`);
  }

  return parts.join(' ');
}
