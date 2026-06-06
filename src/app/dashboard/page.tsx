import { Badge } from "@/components/Badge";
import { Nav } from "@/components/Nav";
import type { AccessStatus, DuesStatus, RequestStatus } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ResidentRow = {
  id: string;
  name: string;
  unit_address: string;
  email: string;
  dues_status: DuesStatus;
  access_status: AccessStatus;
  last_synced_at: string | null;
};

type RequestRow = {
  id: string;
  status: RequestStatus;
};

type ManualTaskRow = {
  id: string;
  instructions: string;
  action: string;
  provider: string;
};

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function ErrorCard({ message }: { message: string }) {
  return <div className="card"><strong>Unable to load dashboard data</strong><p>{message}</p></div>;
}

export default async function DashboardPage() {
  const supabase = createSupabaseServiceClient();
  const [residentsResult, requestsResult, tasksResult] = await Promise.all([
    supabase.from("residents").select("id,name,unit_address,email,dues_status,access_status,last_synced_at").order("unit_address"),
    supabase.from("requests").select("id,status"),
    supabase.from("manual_tasks").select("id,instructions,action,provider").eq("status", "pending").order("created_at", { ascending: false })
  ]);

  const loadError = residentsResult.error ?? requestsResult.error ?? tasksResult.error;
  const residents = (residentsResult.data ?? []) as ResidentRow[];
  const requests = (requestsResult.data ?? []) as RequestRow[];
  const tasks = (tasksResult.data ?? []) as ManualTaskRow[];
  const pendingRequests = requests.filter((request) => request.status !== "done");
  const needsAction = residents.filter((resident) => resident.access_status === "pending" || resident.access_status === "hold");

  return <><Nav /><main><section className="hero"><div><h1>Board transparency dashboard</h1><p>Central view of dues, access, human tasks, request priority, and audit-first decisions.</p></div></section>{loadError ? <ErrorCard message={loadError.message} /> : null}<section className="grid"><div className="card"><h2>{residents.length}</h2><p>Residents tracked</p></div><div className="card"><h2>{needsAction.length}</h2><p>Pending/held access decisions</p></div><div className="card"><h2>{pendingRequests.length}</h2><p>Open requests</p></div></section><h2>Resident registry</h2><table className="table"><thead><tr><th>Name</th><th>Unit</th><th>Dues</th><th>Access</th><th>Last synced</th></tr></thead><tbody>{residents.map((resident) => <tr key={resident.id}><td>{resident.name}<br /><small>{resident.email}</small></td><td>{resident.unit_address}</td><td><Badge value={resident.dues_status} /></td><td><Badge value={resident.access_status} /></td><td>{formatTimestamp(resident.last_synced_at)}</td></tr>)}{residents.length === 0 ? <tr><td colSpan={5}>No residents found. Run the Supabase migration and seed data, or add residents in Supabase.</td></tr> : null}</tbody></table><h2>Pending human-in-the-loop cards</h2>{tasks.length > 0 ? tasks.map((task) => <div className="card" key={task.id}><strong>{task.action} via {task.provider}</strong><p>{task.instructions}</p></div>) : <div className="card"><strong>No pending manual tasks</strong><p>Manual AirAllow or Vantaca actions will appear here when reconciliation creates them.</p></div>}</main></>;
}
