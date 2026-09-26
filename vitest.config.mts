import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest config. Kept minimal: only test/ files, aliases so imports
// match the rest of the codebase, and DB-backed tests run sequentially
// so they don't race each other for the local Postgres.
//
// File is .mts (not .ts) so vitest's native config loader treats it as
// ESM. Without the extension it warns about ESM syntax in a CJS file.
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
      // Stub Next's `server-only` guard - it isn't in node_modules and
      // its runtime behaviour (throw on client bundle) is irrelevant
      // under vitest. See tests/_stubs/server-only.ts for the why.
      "server-only": fileURLToPath(
        new URL("./tests/_stubs/server-only.ts", import.meta.url),
      ),
    },
  },
});
