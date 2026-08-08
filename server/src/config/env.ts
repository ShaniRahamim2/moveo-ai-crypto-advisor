import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  // 32 characters, not 16: HS256 keys shorter than the hash output weaken the
  // signature. Production is a 64-character hex string from `openssl rand -hex 32`.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
});

// Tests never touch a real database or issue real tokens, so they run against
// placeholders rather than requiring a developer to have production values set.
const testDefaults = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret-value-not-used-in-production',
};

const source =
  process.env.NODE_ENV === 'test' ? { ...testDefaults, ...process.env } : process.env;

const parsed = schema.safeParse(source);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
