# Email Workflow Supabase Schema Gap Report

## Scope and method

- Audited every Supabase table reference in application and script code with `rg -n "\\.from\\(\"|\\.from\\('|\\.rpc\\(\"|\\.rpc\\('|select\\(" src scripts tests supabase --glob '!node_modules'`.
- Audited RPC/view references with `rg -n "create (or replace )?view|create materialized view|\\.rpc\\(" -S --glob '!node_modules' .`; none were found.
- Reconciled code usage against the production table inventory supplied in the task: `audit_log`, `idempotency_keys`, `manual_tasks`, `profiles`, `requests`, `residents`, `vantaca_balance_reviews`.
- Reconciled against repository SQL in `supabase/migrations/0001_initial.sql`, `0002_vantaca_balance_reviews.sql`, `0003_request_action_needed.sql`, `0004_request_classification_learning.sql`, and `0005_email_workflow_hooks.sql`.

## Executive summary

The only table referenced by the code but absent from the confirmed production table list is `public.request_classification_feedback`. The inbound email workflow reads this table before checking duplicate email persistence, so its absence produces the confirmed `PGRST205` error. A remedial new-table-only migration was added at:

- `supabase/migrations/20260610000000_restore_request_classification_feedback.sql`

This migration creates only `public.request_classification_feedback`, its RLS policies, and indexes. It does **not** alter, drop, or mutate any of the seven existing production tables.

## Table inventory

### `public.audit_log` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0001_initial.sql`.

**Columns used by code:**

| Column | Operation | Evidence | Type inference / repo definition |
| --- | --- | --- | --- |
| `id` | read after upsert and duplicate lookup; dashboard read | `src/services/audit-service.ts:34-42`, `src/app/audit/page.tsx:20` | `uuid primary key` in `0001_initial.sql:33` |
| `created_at` | dashboard read/order | `src/app/audit/page.tsx:20` | `timestamptz not null default now()` in `0001_initial.sql:42` |
| `actor_id` | insert/upsert | `src/services/audit-service.ts:22-31` | `uuid` in `0001_initial.sql:34` |
| `actor_name` | insert/upsert; dashboard read | `src/services/audit-service.ts:22-31`, `src/app/audit/page.tsx:20` | `text not null default 'system'` in `0001_initial.sql:35` |
| `actor_type` | insert/upsert | `src/services/audit-service.ts:22-31` | `text` with `system`/`user` check in `0001_initial.sql:36` |
| `action` | insert/upsert; dashboard read | `src/services/audit-service.ts:22-31`, `src/app/audit/page.tsx:20` | `text not null` in `0001_initial.sql:37` |
| `target_resident_id` | insert/upsert | `src/services/audit-service.ts:22-31` | `uuid references residents(id)` in `0001_initial.sql:38` |
| `reason` | insert/upsert; dashboard read | `src/services/audit-service.ts:22-31`, `src/app/audit/page.tsx:20` | `text not null` in `0001_initial.sql:39` |
| `before_state` | insert/upsert JSON payload | `src/services/audit-service.ts:22-31` | `jsonb not null default '{}'::jsonb` in `0001_initial.sql:40` |
| `after_state` | insert/upsert JSON payload | `src/services/audit-service.ts:22-31` | `jsonb not null default '{}'::jsonb` in `0001_initial.sql:41` |
| `idempotency_key` | upsert conflict target and lookup | `src/services/audit-service.ts:31-42` | `text not null unique` in `0001_initial.sql:41` |

**Fit assessment:** Code usage fits the repository schema. The email workflow uses `audit_log.idempotency_key` for audit-event idempotency, not message duplicate detection.

### `public.idempotency_keys` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0001_initial.sql`.

**Columns used by code:** none found.

**Fit assessment:** This table is live but unused by current code. The inbound email workflow instead checks `requests.external_message_id` for duplicate message detection.

### `public.manual_tasks` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0001_initial.sql`.

**Columns used by code:**

| Column | Operation | Evidence | Type inference / repo definition |
| --- | --- | --- | --- |
| `id` | dashboard read; duplicate task lookup | `src/app/dashboard/page.tsx:109`, `src/services/dues-reconciliation-service.ts:90-91` | `uuid primary key` in `0001_initial.sql:46` |
| `provider` | insert/read | `src/services/email-workflow-service.ts:44-49`, `src/services/dues-reconciliation-service.ts:95-100`, `src/app/dashboard/page.tsx:109` | `text not null` in `0001_initial.sql:47` |
| `resident_id` | insert/lookup; nullable for email workflow tasks | `src/services/email-workflow-service.ts:44-49`, `src/services/dues-reconciliation-service.ts:91-98` | nullable `uuid references residents(id)` in `0001_initial.sql:48` |
| `action` | insert/read/lookup | `src/services/email-workflow-service.ts:44-49`, `src/services/dues-reconciliation-service.ts:91-98`, `src/app/dashboard/page.tsx:109` | `text not null` in `0001_initial.sql:49` |
| `instructions` | insert/read | `src/services/email-workflow-service.ts:43-49`, `src/services/dues-reconciliation-service.ts:95-100`, `src/app/dashboard/page.tsx:109` | `text not null` in `0001_initial.sql:50` |
| `status` | filter/lookup | `src/app/dashboard/page.tsx:109`, `src/services/dues-reconciliation-service.ts:91` | `manual_task_status not null default 'pending'` in `0001_initial.sql:51` |
| `created_by_audit_id` | insert/lookup | `src/services/email-workflow-service.ts:44-49`, `src/services/dues-reconciliation-service.ts:90-100` | `uuid references audit_log(id)` in `0001_initial.sql:52` |
| `created_at` | dashboard sort | `src/app/dashboard/page.tsx:109` | `timestamptz not null default now()` in `0001_initial.sql:55` |

**Fit assessment:** Code usage fits the repository schema. Email workflow tasks deliberately use `resident_id: null`, which is allowed by the initial schema.

### `public.profiles` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0001_initial.sql`.

**Columns used by code:** no direct `.from("profiles")` usage found. Referenced by foreign keys and by the RLS helper `public.current_app_role()`.

**Fit assessment:** Required indirectly for RLS policies and `created_by` foreign key on the new feedback table.

### `public.requests` — exists in Supabase

**Classification:** (a) exists in Supabase.

**Columns used by code:**

| Column | Operation | Evidence | Type inference / repo definition |
| --- | --- | --- | --- |
| `id` | read/insert return/update filters; FK target | `src/services/email-workflow-service.ts:57-83`, `src/app/dashboard/page.tsx:64-84`, `src/app/triage/page.tsx:30` | `uuid primary key` in `0001_initial.sql:59` |
| `from_email` | insert/read | `src/services/email-workflow-service.ts:66`, `src/app/dashboard/page.tsx:66-72`, `src/app/triage/page.tsx:30` | `text not null` in `0001_initial.sql:60` |
| `subject` | insert/read | `src/services/email-workflow-service.ts:67`, `src/app/dashboard/page.tsx:66-72`, `src/app/triage/page.tsx:30` | `text not null` in `0001_initial.sql:61` |
| `body_text` | insert | `src/services/email-workflow-service.ts:68` | `text not null default ''` in `0001_initial.sql:62` |
| `sanitized_body` | insert/read/update learning seed | `src/services/email-workflow-service.ts:69`, `src/app/dashboard/page.tsx:66-97` | `text not null default ''` in `0001_initial.sql:63` |
| `category` | insert/read/update/filter | `src/services/email-workflow-service.ts:70`, `src/app/dashboard/page.tsx:66-82`, `src/app/dashboard/page.tsx:110`, `src/app/triage/page.tsx:30` | `request_category` in `0001_initial.sql:64` |
| `priority` | insert/read/update | `src/services/email-workflow-service.ts:71`, `src/app/dashboard/page.tsx:66-82`, `src/app/triage/page.tsx:30` | `request_priority` in `0001_initial.sql:65` |
| `status` | read/filter in UI | `src/app/dashboard/page.tsx:108`, `src/app/triage/page.tsx:30` | `request_status` in `0001_initial.sql:66` |
| `classification_reason` | insert/read/update | `src/services/email-workflow-service.ts:73`, `src/app/dashboard/page.tsx:81-82`, `src/app/dashboard/page.tsx:110` | `text not null default ''` in `0001_initial.sql:67` |
| `received_at` | insert/order | `src/services/email-workflow-service.ts:77`, `src/app/triage/page.tsx:30`, `src/app/dashboard/page.tsx:110` | `timestamptz not null default now()` in `0001_initial.sql:68` |
| `action_needed` | insert/read/update | `src/services/email-workflow-service.ts:72`, `src/app/dashboard/page.tsx:66-82`, `src/app/triage/page.tsx:30` | added as `request_action_needed` in `0003_request_action_needed.sql:1-8` |
| `category_confidence` | insert/read/update | `src/services/email-workflow-service.ts:74`, `src/app/dashboard/page.tsx:79`, `src/app/dashboard/page.tsx:110` | added as `numeric(4,3)` in `0004_request_classification_learning.sql:1-4` |
| `categorization_note` | insert/read/update | `src/services/email-workflow-service.ts:75`, `src/app/dashboard/page.tsx:81`, `src/app/dashboard/page.tsx:110` | added as `text` in `0004_request_classification_learning.sql:1-4` |
| `needs_category_review` | insert/update/filter | `src/services/email-workflow-service.ts:76`, `src/app/dashboard/page.tsx:80`, `src/app/dashboard/page.tsx:110` | added as `boolean` in `0004_request_classification_learning.sql:1-4` |
| `inbound_source` | insert | `src/services/email-workflow-service.ts:78` | added as `text` in `0005_email_workflow_hooks.sql:1-4` |
| `external_message_id` | duplicate lookup, insert, unique index expectation | `src/services/email-workflow-service.ts:57-79` | added as `text` with partial unique index in `0005_email_workflow_hooks.sql:1-8` |
| `workflow_started_at` | insert ISO string | `src/services/email-workflow-service.ts:80` | added as `timestamptz` in `0005_email_workflow_hooks.sql:1-4` |

**Fit assessment:** Code usage fits the full repository migration chain. Because the production finding only confirms table names, not columns, the ALTER recommendations below should be checked before applying the new feedback-table migration in production.

### `public.residents` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0001_initial.sql`.

**Columns used by code:**

| Column | Operation | Evidence | Type inference / repo definition |
| --- | --- | --- | --- |
| `id` | read/update/FK target | `src/app/dashboard/page.tsx:107`, `src/app/api/vantaca/import/route.ts:81`, `src/services/dues-reconciliation-service.ts:64-85` | `uuid primary key` in `0001_initial.sql:16` |
| `name` | read | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-65` | `text not null` in `0001_initial.sql:17` |
| `unit_address` | read/order | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-65` | `text not null` in `0001_initial.sql:18` |
| `email` | read | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-65` | `text not null unique` in `0001_initial.sql:19` |
| `dues_status` | read/update | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-84` | `dues_status` in `0001_initial.sql:20` |
| `access_status` | read/update | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-84` | `access_status` in `0001_initial.sql:21` |
| `external_access_id` | read | `src/services/dues-reconciliation-service.ts:64-65` | `text` in `0001_initial.sql:22` |
| `external_billing_id` | read/filter | `src/services/dues-reconciliation-service.ts:64-66` | `text` in `0001_initial.sql:23` |
| `last_synced_at` | read/update | `src/app/dashboard/page.tsx:107`, `src/services/dues-reconciliation-service.ts:64-84` | `timestamptz` in `0001_initial.sql:24` |
| `override_reason` | read | `src/services/dues-reconciliation-service.ts:64-65` | `text` in `0001_initial.sql:25` |

**Fit assessment:** Code usage fits the repository schema.

### `public.vantaca_balance_reviews` — exists in Supabase

**Classification:** (a) exists in Supabase. Defined in `0002_vantaca_balance_reviews.sql`.

**Columns used by code:**

| Column | Operation | Evidence | Type inference / repo definition |
| --- | --- | --- | --- |
| `id` | read/update | `src/app/vantaca/page.tsx:39-46`, `src/app/vantaca/page.tsx:54-57`, `src/app/vantaca/page.tsx:72-74`, `src/app/api/vantaca/import/route.ts:122-125` | `uuid primary key` in `0002_vantaca_balance_reviews.sql:4` |
| `import_key` | upsert conflict target | `src/app/api/vantaca/import/route.ts:122-124` | `text not null unique` in `0002_vantaca_balance_reviews.sql:5` |
| `external_billing_id` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `text` in `0002_vantaca_balance_reviews.sql:6` |
| `unit_address` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `text` in `0002_vantaca_balance_reviews.sql:7` |
| `resident_name` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:83-84` | `text` in `0002_vantaca_balance_reviews.sql:8` |
| `email` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `text` in `0002_vantaca_balance_reviews.sql:9` |
| `balance` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `numeric(12,2)` in `0002_vantaca_balance_reviews.sql:10` |
| `dues_status` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `dues_status` in `0002_vantaca_balance_reviews.sql:11` |
| `balance_reference` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:39-46` | `text not null default ''` in `0002_vantaca_balance_reviews.sql:12` |
| `source` | upsert/read | `src/app/api/vantaca/import/route.ts:106-118`, `src/app/vantaca/page.tsx:83-84` | `text not null default 'manual-import'` in `0002_vantaca_balance_reviews.sql:13` |
| `matched_resident_id` | upsert/read | `src/app/api/vantaca/import/route.ts:106-125`, `src/app/vantaca/page.tsx:39-46` | `uuid references residents(id)` in `0002_vantaca_balance_reviews.sql:14` |
| `status` | upsert/read/update | `src/app/api/vantaca/import/route.ts:106-131`, `src/app/vantaca/page.tsx:54-74` | `vantaca_review_status` in `0002_vantaca_balance_reviews.sql:15` |
| `error_message` | read/update | `src/app/vantaca/page.tsx:54-58`, `src/app/vantaca/page.tsx:83-84` | `text` in `0002_vantaca_balance_reviews.sql:16` |
| `imported_at` | read/order | `src/app/vantaca/page.tsx:39-46`, `src/app/vantaca/page.tsx:83-85` | `timestamptz not null default now()` in `0002_vantaca_balance_reviews.sql:17` |
| `reviewed_at` | update | `src/app/vantaca/page.tsx:54-58`, `src/app/vantaca/page.tsx:72-74` | `timestamptz` in `0002_vantaca_balance_reviews.sql:18` |

**Fit assessment:** Code usage fits the repository schema.

### `public.request_classification_feedback` — absent from Supabase

**Classification:** (b) referenced in code but absent from confirmed production table list. Defined in repo migration `0004_request_classification_learning.sql`, but production currently lacks the table, so a new remedial migration is needed.

**Columns used by code:**

| Column | Operation | Evidence | Type chosen in remedial migration |
| --- | --- | --- | --- |
| `id` | implicit primary key | repo SQL `0004_request_classification_learning.sql:6-20` | `uuid primary key default gen_random_uuid()` |
| `request_id` | insert FK to request | `src/app/dashboard/page.tsx:87-98` | `uuid references public.requests(id) on delete set null` |
| `from_category` | insert | `src/app/dashboard/page.tsx:87-98` | `public.request_category not null` |
| `to_category` | insert/read for learned classification | `src/app/dashboard/page.tsx:87-98`, `src/services/request-learning-service.ts:40-44` | `public.request_category not null` |
| `from_priority` | insert | `src/app/dashboard/page.tsx:87-98` | `public.request_priority not null` |
| `to_priority` | insert/read for learned classification | `src/app/dashboard/page.tsx:87-98`, `src/services/request-learning-service.ts:40-44` | `public.request_priority not null` |
| `from_action_needed` | insert | `src/app/dashboard/page.tsx:87-98` | `public.request_action_needed not null` |
| `to_action_needed` | insert/read for learned classification | `src/app/dashboard/page.tsx:87-98`, `src/services/request-learning-service.ts:40-44` | `public.request_action_needed not null` |
| `subject` | insert | `src/app/dashboard/page.tsx:87-98` | `text not null` |
| `sanitized_body` | insert | `src/app/dashboard/page.tsx:87-98` | `text not null default ''` |
| `tokens` | insert/read array overlap scoring | `src/app/dashboard/page.tsx:72-98`, `src/services/request-learning-service.ts:28-44` | `text[] not null default '{}'` |
| `created_at` | learned-classification order | `src/services/request-learning-service.ts:40-44` | `timestamptz not null default now()` |
| `created_by` | no current application write; repo SQL includes FK | repo SQL `0004_request_classification_learning.sql:18-19` | `uuid references public.profiles(id)` |

**Fit assessment:** The remedial migration matches current code and repository SQL, with additional indexes and idempotent policy creation.

## Repo SQL that is unused or not confirmed in production

**Classification:** (c) defined in repo SQL but unused or not confirmed in Supabase.

- `public.idempotency_keys` is defined in `0001_initial.sql` and exists in production, but no code references it.
- `public.request_classification_feedback` is defined in `0004_request_classification_learning.sql`, but is not present in production. The new remedial migration recreates only that missing table.
- No views, materialized views, or RPC functions are referenced by application code.

## ALTER TABLE recommendations for existing tables — do not apply without approval

The migration added in this task intentionally avoids DDL against existing tables. Before or immediately after creating `request_classification_feedback`, verify the following columns exist on `public.requests`. If any are missing, apply a separately approved migration because the email workflow and dashboard depend on them.

```sql
-- Recommended only if the request_action_needed type or action_needed column is absent.
create type public.request_action_needed as enum (
  'emergency_response',
  'access_follow_up',
  'facility_repair',
  'vendor_follow_up',
  'invoice_review',
  'board_review'
);

alter table public.requests
  add column action_needed public.request_action_needed not null default 'board_review';
```

Evidence: the email workflow inserts `action_needed`, the dashboard reads and updates it, and triage reads it (`src/services/email-workflow-service.ts:72`, `src/app/dashboard/page.tsx:66-82`, `src/app/triage/page.tsx:30`).

```sql
-- Recommended only if these category-review columns are absent.
alter table public.requests
  add column category_confidence numeric(4, 3) not null default 0,
  add column categorization_note text not null default '',
  add column needs_category_review boolean not null default false;
```

Evidence: the email workflow inserts these values and the dashboard reads/updates/filters them (`src/services/email-workflow-service.ts:74-76`, `src/app/dashboard/page.tsx:79-81`, `src/app/dashboard/page.tsx:110`).

```sql
-- Recommended only if these inbound-email workflow columns/index are absent.
alter table public.requests
  add column inbound_source text not null default 'email-webhook',
  add column external_message_id text,
  add column workflow_started_at timestamptz;

create unique index requests_external_message_id_idx
  on public.requests (external_message_id)
  where external_message_id is not null;
```

Evidence: duplicate detection checks `external_message_id` before inserting; first-run persistence writes `inbound_source`, `external_message_id`, and `workflow_started_at` (`src/services/email-workflow-service.ts:57-80`).

## Apply instructions

### Path A: Supabase CLI

1. Confirm you are pointed at the `AirAllow Workflow` project and production branch.
2. From the repository root, run:

   ```bash
   supabase db push
   ```

3. If your CLI/session does not automatically refresh PostgREST schema cache, run this against the production database afterward:

   ```sql
   notify pgrst, 'reload schema';
   ```

### Path B: Supabase SQL Editor

1. Open the Supabase Dashboard for `AirAllow Workflow`.
2. Select the production/main branch and the `public` schema.
3. Copy the full contents of `supabase/migrations/20260610000000_restore_request_classification_feedback.sql` into the SQL Editor.
4. Run it once. The migration is idempotent for repeat runs where practical.
5. Confirm the final statement ran successfully:

   ```sql
   notify pgrst, 'reload schema';
   ```

## Verification plan

1. In Supabase Table Editor, confirm `public.request_classification_feedback` exists with RLS enabled.
2. In SQL Editor, optionally confirm columns and policies:

   ```sql
   select column_name, data_type, udt_name
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'request_classification_feedback'
   order by ordinal_position;

   select policyname, cmd
   from pg_policies
   where schemaname = 'public'
     and tablename = 'request_classification_feedback'
   order by policyname;
   ```

3. Re-run the Zapier test with the same structured payload fields: `messageId`, `fromEmail`, `subject`, `bodyText`, `receivedAt`.
4. Expected first run after the schema fix: HTTP `201` with `persisted: true` and `duplicate: false`.
5. Expected re-test with the identical sample email/message ID: HTTP `200` with `duplicate: true`. This is correct behavior and proves `requests.external_message_id` duplicate detection is working.
6. Confirm data landed:

   ```sql
   select id, external_message_id, subject, category, priority, action_needed, received_at
   from public.requests
   where external_message_id = '<messageId from Zapier test>';

   select id, provider, action, instructions, created_by_audit_id, created_at
   from public.manual_tasks
   where provider = 'email-workflow'
   order by created_at desc
   limit 5;

   select id, action, idempotency_key, created_at
   from public.audit_log
   where idempotency_key = 'email:<messageId from Zapier test>:workflow';
   ```

7. After a board member recategorizes a low-confidence/`other` request in the dashboard, confirm feedback rows are created:

   ```sql
   select id, request_id, to_category, to_priority, to_action_needed, tokens, created_at
   from public.request_classification_feedback
   order by created_at desc
   limit 5;
   ```

## Code-side mismatches / risks to flag

- The repository already contains `0004_request_classification_learning.sql`, which creates `request_classification_feedback`, but production does not have the table. This suggests production migration history and actual schema may be out of sync. The remedial migration uses a later timestamp/name so it can repair production without relying on replaying `0004`.
- `public.idempotency_keys` exists but is not used by the inbound email workflow. Duplicate detection is implemented with `requests.external_message_id`, so the `requests_external_message_id_idx` partial unique index is the critical duplicate-protection object.
- The dashboard and routes use `createSupabaseServiceClient()`, so server-side app reads/writes bypass RLS. The new table still enables RLS and includes board read plus service-role management policies for consistency with existing migration patterns.
