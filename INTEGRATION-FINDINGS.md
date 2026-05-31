# Integration Findings

Research performed first on 2026-05-31 before any integration code was written. Default implementation therefore uses human-in-the-loop manual adapters until the HOA or management company obtains vendor-approved credentials and implementation terms.

## AirAllow / Allow Enclave

| Field | Finding |
| --- | --- |
| API available | Unknown / not publicly documented for AirAllow-Enclave. |
| Public/partner API, webhooks, exports | Public search found product/app and capability documentation, but no public developer portal, OpenAPI document, webhook docs, or admin export/API docs specific to AirAllow-Enclave access grants/revokes. |
| What it supports | The AirAllow Remote Pro cloud service and Enclave app/web portal support remote administration, user access management, access privilege changes, app-less links, cards/fobs/keypads, schedules, and audit/entry logging. These capabilities are documented as app/portal product features rather than an external API contract. |
| Auth method | Unknown for third-party integration. Native app/portal auth only; no public API auth method found. |
| Rate limits | Unknown; no public rate-limit documentation found. |
| Sources | AirAllow capability sheet: https://www.airallow.com/_files/ugd/20a0b0_1191381ef8874bccb534249cb14cae28.pdf. Apple App Store listing: https://apps.apple.com/us/app/airallow-enclave/id1345925159. AirAllow capability sheet describes a Google Cloud-hosted service accessed through the Enclave app and admin web portal, plus access privilege changes and remote administration. Apple App Store description says administrators can add/delete users and customize access levels. No API docs were found during targeted searches for `AirAllow API` and `Allow Enclave API`. |

Design decision: use `ManualTaskAccessAdapter` by default. `AirAllowApiAdapter` is intentionally stubbed behind the same `AccessProvider` interface and must remain disabled until vendor-approved API credentials, grant/revoke endpoints, auth, idempotency, and rate limits are confirmed.

## Vantaca

| Field | Finding |
| --- | --- |
| API available | Yes, Vantaca marketing states an open API exists; detailed public API docs/endpoints for balance sync were not found. Treat as partner/vendor-approved API only until credentials/docs are provided. |
| Public/partner API, webhooks, exports | Vantaca FAQ says its open API supports custom integrations and data syncing. Vantaca Library documents a Reports area with Financials, Homeowner, Statements, and export/download formats including Excel/PDF/CSV; Homeowner reports include transaction history, contact exports, statements, and balances-related reports. Webhook documentation for resident balances was not found. |
| What it supports | Confirmed public docs support reports and downloadable exports that can include balances/statement data. API scope for resident balances is likely possible but unconfirmed without Vantaca partner documentation. |
| Auth method | Unknown in public docs for API. Reports require Vantaca role/report permissions. |
| Rate limits | Unknown; no public rate-limit documentation found. Vantaca Terms prohibit bots/scrapers/automated extraction except as expressly permitted, so this app must use approved API credentials or approved report exports only. |
| Sources | Vantaca FAQ API section: https://www.vantaca.com/vantaca-faq. Vantaca Library reports documentation: https://support.vantaca.com/hc/en-us/articles/360016173892-How-to-View-Vantaca-Reports and https://support.vantaca.com/hc/en-us/articles/360030536591-Types-of-Reports. Vantaca Terms of Service API/automation restrictions: https://www.vantaca.com/terms-of-service. |

Design decision: use `ManualTaskBillingAdapter` / CSV-report style sync by default. `VantacaApiBillingAdapter` is stubbed behind `BillingProvider` and must not be enabled until Vantaca provides approved credentials, endpoint docs, auth, and rate limits.
