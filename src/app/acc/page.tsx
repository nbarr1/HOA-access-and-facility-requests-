import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import type { AccRequestStatus } from "@/domain/types";
import { requireAccAccess } from "@/lib/navigation-auth";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type AccRequestRow = {
  id: string;
  title: string;
  description: string;
  status: AccRequestStatus;
  submitted_at: string;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export default async function AccPage() {
  const access = await requireAccAccess();
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("acc_requests").select("id,title,description,status,submitted_at").order("submitted_at", { ascending: false });
  const requests = (data ?? []) as AccRequestRow[];

  return <><Nav access={access} /><main><section className="hero"><div><h1>ACC review queue</h1><p>Architectural Control Committee requests are reviewed through dedicated committee membership, separate from global board access.</p></div></section>{error ? <div className="card"><strong>Unable to load ACC requests</strong><p>{error.message}</p></div> : null}<table className="table"><thead><tr><th>Status</th><th>Title</th><th>Description</th><th>Submitted</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><Badge value={request.status} /></td><td>{request.title}</td><td>{request.description}</td><td>{formatTimestamp(request.submitted_at)}</td></tr>)}{requests.length === 0 ? <tr><td colSpan={4}>No ACC requests found. Submitted architectural requests will appear here for board and ACC committee review.</td></tr> : null}</tbody></table></main></>;
}
