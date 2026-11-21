import 'dotenv/config';
import { z } from 'zod';

const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'Must be a PostgreSQL connection URL.',
  });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl.optional(),
  JWT_SECRET: z.string().min(32).optional(),
  FRONTEND_ORIGIN: z.url().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${details}`);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
