import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url =
  process.env.DATABASE_URL ??
  'postgres://magenta:magenta_dev@localhost:5433/magenta_blumen';

const queryClient = postgres(url);
export const db = drizzle(queryClient, { schema });
