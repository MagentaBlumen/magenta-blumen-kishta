# magenta-blumen-kishta

Online shop for **Magenta Blumen**, a florist in Neuenhof AG, Switzerland.
German-language storefront, local delivery to 27 postcode zones by her own
van, plus in-store pickup.

**Stack:** Next.js 15 (App Router) · TypeScript · Postgres 17 · Drizzle ·
Auth.js v5 · Stripe (card + TWINT) · Resend · Cloudflare R2 · Luxon ·
Tailwind + shadcn/ui · Hetzner.

## Getting started

```bash
npm install
npm run db:up          # Postgres 17 in Docker (host port 5433)
npm run dev            # Next.js at http://localhost:3000
```

Prerequisites: Node 22+, Docker Desktop.

## Conventions and load-bearing rules

See [`CLAUDE.md`](./CLAUDE.md) — the working agreement for anyone (human or
AI) touching this codebase. Twelve rules that do not bend, plus reference
docs under [`docs/`](./docs/).
