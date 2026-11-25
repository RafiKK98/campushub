import { PrismaPg } from '@prisma/adapter-pg';
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.ts';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 5000,
});

if (process.env.VERCEL === '1') {
  attachDatabasePool(pool);
}

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
