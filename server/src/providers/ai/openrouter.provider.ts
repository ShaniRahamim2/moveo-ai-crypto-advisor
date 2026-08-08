import { fetchJson, ProviderError } from '../../lib/httpClient.js';
import { buildInsightPrompt, SYSTEM_PROMPT } from './prompt.js';
import type { AIProvider, InsightInput } from './types.js';

const TIMEOUT_MS = 12_000;

interface ChatCompletion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string; code?: number };
}

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';

  constructor(
    readonly model = process.env.OPENROUTER_MODEL ?? '',
    private readonly apiKey = process.env.OPENROUTER_API_KEY ?? '',
    private readonly baseUrl = process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai/api/v1',
  ) {}

  get configured(): boolean {
    return this.apiKey.length > 0 && this.model.length > 0;
  }

  async generateInsight(input: InsightInput): Promise<string> {
    if (!this.configured) {
      throw new ProviderError('http_error', 'OpenRouter is not configured');
    }

    const body = await fetchJson<ChatCompletion>(`${this.baseUrl}/chat/completions`, {
      timeoutMs: TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        max_tokens: 900,
        temperature: 0.6,
        // Reasoning models otherwise spend the whole token budget thinking and
        // return empty content.
        reasoning: { enabled: false },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildInsightPrompt(input) },
        ],
      }),
    });

    if (body.error) {
      throw new ProviderError('http_error', body.error.message ?? 'OpenRouter returned an error');
    }

    const content = body.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ProviderError('parse_error', 'Model returned no content');
    }

    return content;
  }
}
