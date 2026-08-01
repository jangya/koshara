import {drizzle} from 'drizzle-orm/node-postgres';
import {Pool} from 'pg';
import {z} from 'zod';

import * as schema from './schema';

const databaseUrlSchema = z.url().refine((url) => url.startsWith('postgres://') || url.startsWith('postgresql://'), {
  message: 'DATABASE_URL must use the PostgreSQL protocol',
});

export function createDatabase(databaseUrl: string) {
  const connectionString = databaseUrlSchema.parse(databaseUrl);
  const pool = new Pool({connectionString, max: 5});
  return drizzle({client: pool, schema});
}

export type KosharaDatabase = ReturnType<typeof createDatabase>;
