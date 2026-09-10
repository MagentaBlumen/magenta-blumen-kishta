import type { Config } from 'drizzle-kit';

const localDefault = 'postgres://magenta:magenta_dev@localhost:5433/magenta_blumen';

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? localDefault,
  },
} satisfies Config;
