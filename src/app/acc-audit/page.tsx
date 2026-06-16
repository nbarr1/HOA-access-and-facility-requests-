import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AccessRequestRow = {
  id: string;
  subject: string;
  from_email: string;
  status: string;
  priority: string;
  received_at: string;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default async function AccAuditPage() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("requests")
    .select("id,subject,from_email,status,priority,received_at")
    .eq("category", "access")
    .order("received_at", { ascending: false })
    .limit(100);
  const requests = (data ?? []) as AccessRequestRow[];

  return <main><h1>ACC Audit</h1><p>Access-related requests for authorized board and ACC committee review.</p>{error ? <div className="card"><strong>Unable to load ACC requests</strong><p>{error.message}</p></div> : null}<table className="table"><thead><tr><th>Received</th><th>Priority</th><th>Status</th><th>Subject</th><th>From</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td>{formatTimestamp(request.received_at)}</td><td>{request.priority}</td><td>{request.status}</td><td>{request.subject}</td><td>{request.from_email}</td></tr>)}{requests.length === 0 ? <tr><td colSpan={5}>No ACC requests found.</td></tr> : null}</tbody></table></main>;
}
