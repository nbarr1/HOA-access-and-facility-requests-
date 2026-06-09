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

## Manual Vantaca balance review

When Vantaca API credentials are unavailable, import balances into the review queue instead of automating access changes directly.

CSV import:

```bash
curl -X POST "$HOA_APP_BASE_URL/api/vantaca/import" \
  -H "x-hoa-sync-secret: $INBOUND_EMAIL_SHARED_SECRET" \
  -H "content-type: text/csv" \
  --data-binary @vantaca-balances.csv
```

Accepted CSV headers include `externalBillingId`, `accountId`, `unitAddress`, `address`, `residentName`, `name`, `email`, `balance`, `amountDue`, `balanceReference`, and `asOf`. Positive balances stage as `lapsed`; zero or negative balances stage as `paid`.

Review staged rows at `/vantaca`. Approving a matched row reconciles dues, writes audit rows, and creates manual AirAllow tasks when access needs to change.

Optional Playwright-assisted read:

```bash
npm run vantaca:read-balance -- "204 Pine Court"
```

Configure the `VANTACA_*_SELECTOR` values in `.env.local` for the current Vantaca UI. The helper reads one balance and posts it to the review queue; it does not change Vantaca or AirAllow.

## Email triage categorization

Forward inbound HOA email to `/api/email` with header `x-hoa-email-secret`. The route stores each message in `requests` with a category, priority, and action needed.

| Match | Category | Priority | Action needed |
| --- | --- | --- | --- |
| `flood`, `fire`, `injur`, `broken gate`, `no access`, `locked out`, `security`, `emergency` | keyword category | urgent | emergency_response |
| `access`, `key`, `fob`, `credential`, `gate code`, `locked out` | access | high if access keyword also matches high-priority rule | access_follow_up |
| `pool`, `tennis`, `clubhouse`, `light`, `gate`, `landscap`, `repair`, `leak`, `broken` | facilities | high unless urgent keyword matches | facility_repair |
| `proposal`, `quote`, `vendor`, `contractor`, `w-9` | vendor | normal unless priority keyword matches | vendor_follow_up |
| `invoice`, `bill`, `payment due`, `remittance` | invoice | normal unless priority keyword matches | invoice_review |
| no category keyword | other | normal unless priority keyword matches | board_review |

The triage page sorts requests by priority: urgent, high, normal, then low.

Unknown or low-confidence emails are not left uncategorized. They are stored as `other` with `board_review`, marked `needs_category_review`, and surfaced on the dashboard. When a board member saves a corrected category, priority, and action, the correction is stored in `request_classification_feedback`. Future inbound emails compare their tokens against those board corrections before falling back to the static rules, so repeated recategorizations improve classification over time.
