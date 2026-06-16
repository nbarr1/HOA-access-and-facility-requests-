import { Badge } from "@/components/Badge";
import type { RequestActionNeeded, RequestCategory, RequestPriority, RequestStatus } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const weight = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
const actionLabels: Record<RequestActionNeeded, string> = {
  emergency_response: "Emergency response",
  access_follow_up: "Access follow-up",
  facility_repair: "Facility repair",
  vendor_follow_up: "Vendor follow-up",
  invoice_review: "Invoice review",
  board_review: "Board review"
};

type RequestRow = {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  action_needed: RequestActionNeeded;
  subject: string;
  from_email: string;
};

export default async function TriagePage() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("requests").select("id,category,priority,status,action_needed,subject,from_email").order("received_at", { ascending: false });
  const sorted = ((data ?? []) as RequestRow[]).sort((a, b) => weight[a.priority] - weight[b.priority]);

  return <main><h1>Request triage queue</h1><p>Inbound HOA email is parsed into structured request records and sorted so urgent access/facility issues surface first.</p>{error ? <div className="card"><strong>Unable to load requests</strong><p>{error.message}</p></div> : null}<table className="table"><thead><tr><th>Priority</th><th>Category</th><th>Action needed</th><th>Subject</th><th>From</th><th>Status</th></tr></thead><tbody>{sorted.map((request) => <tr key={request.id}><td><Badge value={request.priority} /></td><td>{request.category}</td><td>{actionLabels[request.action_needed]}</td><td>{request.subject}</td><td>{request.from_email}</td><td><Badge value={request.status} /></td></tr>)}{sorted.length === 0 ? <tr><td colSpan={6}>No requests found. Inbound email records will appear here after `/api/email` persists them.</td></tr> : null}</tbody></table></main>;
}
