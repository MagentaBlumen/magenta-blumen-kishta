import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest config. Kept minimal: only test/ files, one alias so imports
// match the rest of the codebase, and DB-backed tests run in a single
// file so they don't race each other for the local Postgres.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // fileParallelism off so the concurrency test's fixtures don't
    // trip over anything else that talks to the same tables.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
