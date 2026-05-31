# HOA Facility Access & Request Management

A Next.js + Supabase application for HOA boards to transparently grant/revoke facility access based on dues status and triage incoming email requests without burying urgent items.

## Architecture

- **Frontend/backend:** Next.js App Router, TypeScript strict mode.
- **Database/auth:** Supabase Postgres + Auth + Row Level Security.
- **Background work:** Vercel Cron or Supabase scheduled functions invoking `/api/dues-sync`.
- **Email ingestion:** Forward the existing HOA inbox to `/api/email` through any inbound-email-to-webhook service.
- **Integrations:** All external systems are behind provider interfaces. Manual human-in-the-loop adapters are the default because AirAllow public APIs are unconfirmed and Vantaca API details require vendor-approved credentials.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run typecheck
npm test
npm run dev
```

Apply `supabase/migrations/0001_initial.sql` in Supabase, then run:

```bash
npm run seed
```

## Environment variables

See `.env.example`.

- `AIRALLOW_ADAPTER=manual|api`
- `VANTACA_ADAPTER=manual|api`
- API mode requires vendor-approved base URL/token values.
- `INBOUND_EMAIL_SHARED_SECRET` signs email webhook requests with `x-hoa-email-secret`.

## Switching adapters

Business logic calls `AccessProvider` and `BillingProvider` only. To switch from manual to API, set the adapter env var and provide vendor-approved credentials. No domain service changes should be required.

## Deployment on free tiers

1. Create a Supabase project and run the migration.
2. Enable Supabase Auth and add board users in `profiles` with `board_admin` or `board_member` role.
3. Deploy to Vercel and set env vars.
4. Add a Vercel Cron for `/api/dues-sync` if approved Vantaca sync exists; otherwise use exported reports/manual sync.
5. Configure the HOA inbox forwarding/parsing service to POST to `/api/email`.

## Manual-vs-automated tradeoff

Every dues status change creates an audit row before provider action. If the provider is manual, the app creates a board task with precise instructions. A named board member performs the action in AirAllow/Vantaca and marks it done; that completion is audited.
