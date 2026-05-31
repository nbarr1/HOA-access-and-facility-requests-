import { Nav } from "@/components/Nav";

export default function AuditPage() {
  return <><Nav /><main><h1>Audit trail</h1><p>All mutations append immutable audit rows with actor, action, reason, before/after state, and timestamp. Export CSV from Supabase or the future board action menu.</p><table className="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Reason</th></tr></thead><tbody><tr><td>2026-05-30 12:00 UTC</td><td>system</td><td>decision.revoke</td><td>Dues lapsed.</td></tr><tr><td>2026-05-30 12:01 UTC</td><td>system</td><td>provider.manual_task_created</td><td>Manual AirAllow action card created before access changes.</td></tr></tbody></table></main></>;
}
