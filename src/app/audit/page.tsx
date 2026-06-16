import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  created_at: string;
  actor_name: string;
  action: string;
  reason: string;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default async function AuditPage() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("audit_log").select("id,created_at,actor_name,action,reason").order("created_at", { ascending: false }).limit(100);
  const auditRows = (data ?? []) as AuditRow[];

  return <main><h1>Audit trail</h1><p>All mutations append immutable audit rows with actor, action, reason, before/after state, and timestamp. Export CSV from Supabase or the future board action menu.</p>{error ? <div className="card"><strong>Unable to load audit rows</strong><p>{error.message}</p></div> : null}<table className="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Reason</th></tr></thead><tbody>{auditRows.map((entry) => <tr key={entry.id}><td>{formatTimestamp(entry.created_at)}</td><td>{entry.actor_name}</td><td>{entry.action}</td><td>{entry.reason}</td></tr>)}{auditRows.length === 0 ? <tr><td colSpan={4}>No audit rows found. Decision and provider events will appear here after reconciliation runs.</td></tr> : null}</tbody></table></main>;
}
