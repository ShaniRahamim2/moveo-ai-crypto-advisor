type Level = 'info' | 'warn' | 'error';

export interface ProviderLogFields {
  provider: string;
  outcome: 'ok' | 'fallback' | 'timeout' | 'rate_limited' | 'http_error' | 'network_error';
  durationMs: number;
  status?: number;
  detail?: string;
}

// Structured single-line logs. Only the fields below are ever emitted, so a URL
// carrying an auth token cannot reach the log by accident.
function emit(level: Level, event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ level, event, ...fields, at: new Date().toISOString() });
  if (level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }
}

export const logger = {
  provider(fields: ProviderLogFields) {
    emit(fields.outcome === 'ok' ? 'info' : 'warn', 'provider_call', { ...fields });
  },
  warn(event: string, fields: Record<string, unknown> = {}) {
    emit('warn', event, fields);
  },
  error(event: string, fields: Record<string, unknown> = {}) {
    emit('error', event, fields);
  },
};
