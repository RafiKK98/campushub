import 'dotenv/config';
import { z } from 'zod';

const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'Must be a PostgreSQL connection URL.',
  });

const booleanString = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl.optional(),
  JWT_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
  AUTH_COOKIE_NAME: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/)
    .default('campushub_session'),
  AUTH_COOKIE_SECURE: booleanString,
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(28800),
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional(),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

// Ensure cookie secure is true in production unless explicitly set to false via env (which we disallow)
if (parsed.data.NODE_ENV === 'production' && parsed.data.AUTH_COOKIE_SECURE === false) {
  throw new Error('AUTH_COOKIE_SECURE must be true in production');
}

// If sameSite is 'none', secure must be true
if (parsed.data.AUTH_COOKIE_SAME_SITE === 'none' && parsed.data.AUTH_COOKIE_SECURE !== true) {
  throw new Error('AUTH_COOKIE_SAME_SITE "none" requires AUTH_COOKIE_SECURE=true');
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
