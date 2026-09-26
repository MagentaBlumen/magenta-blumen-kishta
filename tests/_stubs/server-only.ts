// Vitest-only stub for the `server-only` package.
//
// Next ships `server-only` and throws at import time if anything tries to
// bundle it into a client build - that's the whole point of the guard.
// Under vitest running plain node the package isn't in node_modules and
// the import fails, taking down the whole test file before a single test
// can run.
//
// Aliased in vitest.config.mts. Do NOT publish this file or reference it
// from application code.
export {};
