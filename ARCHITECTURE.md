# Architecture

## Data model

- `profiles`: board/resident role mapped to Supabase users.
- `residents`: resident registry, dues status, access status, external references, last sync.
- `audit_log`: append-only ledger of all decisions and mutations.
- `manual_tasks`: human-in-the-loop cards for external systems when no approved API exists.
- `requests`: inbound email/request triage queue.
- `idempotency_keys`: retry guard for webhooks/syncs.

## Access status state machine

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> granted: dues_paid + grant succeeds/manual done
  pending --> revoked: dues_lapsed + revoke succeeds/manual done
  granted --> revoked: dues_lapsed
  revoked --> granted: dues_paid
  granted --> hold: board override
  revoked --> hold: board override
  hold --> granted: board force-grant
  hold --> revoked: board force-revoke
```

Rules:

- Dues paid means desired access is `granted` unless a board override puts the resident on `hold`.
- Dues lapsed means desired access is `revoked` unless the board explicitly force-grants with a reason.
- Every transition requires an audit row before provider action.
- Provider action is idempotent and records an idempotency key.

## Dues-change sequence

```mermaid
sequenceDiagram
  participant Cron as Vercel/Supabase schedule
  participant Billing as BillingProvider
  participant Domain as AccessDecisionService
  participant Audit as Audit Log
  participant Access as AccessProvider
  participant Task as Manual Task Queue

  Cron->>Billing: fetchDuesStatuses(since)
  Billing-->>Cron: resident dues records
  Cron->>Domain: reconcileDuesStatus(resident, dues)
  Domain->>Audit: append decision before action
  alt API adapter enabled and approved
    Domain->>Access: grant/revoke(idempotencyKey)
    Access-->>Domain: provider result
    Domain->>Audit: append provider result
  else manual default
    Domain->>Task: create action card
    Domain->>Audit: append manual task created
  end
```
