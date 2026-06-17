import { Badge } from "@/components/Badge";
import type { AccessStatus, DuesStatus, RequestActionNeeded, RequestCategory, RequestPriority, RequestStatus } from "@/domain/types";
import { requestActionOptions, requestCategoryOptions, requestPriorityOptions, requestStatusOptions } from "@/domain/categorization-rules";
import { updateRequestTriage } from "@/app/actions/request-actions";
import Link from "next/link";
import { requireBoardUser } from "@/lib/navigation-auth";
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

type CategorizationReviewRow = {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  action_needed: RequestActionNeeded;
  subject: string;
  from_email: string;
  sanitized_body: string;
  classification_reason: string;
  categorization_note: string;
  category_confidence: number;
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

function EmailBody({ body }: { body: string }) {
  const normalizedBody = body?.trim() || "No email body available.";
  const isLong = normalizedBody.length > 500;

  if (!isLong) {
    return <p className="email-body">{normalizedBody}</p>;
  }

  return (
    <details className="email-body-details">
      <summary>Show full email body</summary>
      <p className="email-body">{normalizedBody}</p>
    </details>
  );
}

export default async function DashboardPage() {
  await requireBoardUser();
  const supabase = createSupabaseServiceClient();
  const [residentsResult, requestsResult, tasksResult, categorizationResult] = await Promise.all([
    supabase.from("residents").select("id,name,unit_address,email,dues_status,access_status,last_synced_at").order("unit_address"),
    supabase.from("requests").select("id,status"),
    supabase.from("manual_tasks").select("id,instructions,action,provider").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("requests").select("id,category,priority,action_needed,status,subject,from_email,sanitized_body,classification_reason,categorization_note,category_confidence").or("category.eq.other,needs_category_review.eq.true").order("received_at", { ascending: false }).limit(10)
  ]);

  const loadError = residentsResult.error ?? requestsResult.error ?? tasksResult.error ?? categorizationResult.error;
  const residents = (residentsResult.data ?? []) as ResidentRow[];
  const requests = (requestsResult.data ?? []) as RequestRow[];
  const openReviewRequests = requests.filter((request) => request.status !== "done");
  const tasks = (tasksResult.data ?? []) as ManualTaskRow[];
  const categorizationReviews = (categorizationResult.data ?? []) as CategorizationReviewRow[];
  const pendingRequests = openReviewRequests;
  const needsAction = residents.filter((resident) => resident.access_status === "pending" || resident.access_status === "hold");

  return <main><section className="hero"><div><h1>Board transparency dashboard</h1><p>Central view of dues, access, human tasks, request priority, and audit-first decisions.</p></div></section>{loadError ? <ErrorCard message={loadError.message} /> : null}<section className="grid"><div className="card"><h2>{residents.length}</h2><p>Residents tracked</p></div><div className="card"><h2>{needsAction.length}</h2><p>Pending/held access decisions</p></div><div className="card"><h2>{pendingRequests.length}</h2><p>Total open requests</p><Link className="button-link" href="/triage">View all requests</Link></div><div className="card"><h2>{categorizationReviews.length}</h2><p>Latest categories needing review</p><small>Showing up to 10 newest emails that are uncategorized or flagged.</small></div></section><h2>Email categorization review</h2>{categorizationReviews.length > 0 ? <table className="table"><thead><tr><th>Email</th><th>Current result</th><th>Board category</th><th>Priority</th><th>Action</th><th>Status</th><th></th></tr></thead><tbody>{categorizationReviews.map((request) => <tr key={request.id}><td className="email-context-cell"><strong>{request.subject}</strong><br /><small>{request.from_email}</small><EmailBody body={request.sanitized_body} /><small>{request.categorization_note || "Notated as unclear."}</small></td><td><Badge value={request.category} /><br /><small>{Math.round(Number(request.category_confidence) * 100)}% confidence</small><br /><small>{request.classification_reason}</small></td><td><form id={`cat-${request.id}`} action={updateRequestTriage}><input type="hidden" name="id" value={request.id} /><select name="category" defaultValue={request.category}>{requestCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></form></td><td><select form={`cat-${request.id}`} name="priority" defaultValue={request.priority}>{requestPriorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td><td><select form={`cat-${request.id}`} name="action_needed" defaultValue={request.action_needed}>{requestActionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td><td><select form={`cat-${request.id}`} name="status" defaultValue={request.status}>{requestStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td><td><button form={`cat-${request.id}`} type="submit">Save</button></td></tr>)}</tbody></table> : <div className="card"><strong>All emails categorized</strong><p>Unknown or low-confidence emails will appear here for board review.</p></div>}<h2>Resident registry</h2><table className="table"><thead><tr><th>Name</th><th>Unit</th><th>Dues</th><th>Access</th><th>Last synced</th></tr></thead><tbody>{residents.map((resident) => <tr key={resident.id}><td>{resident.name}<br /><small>{resident.email}</small></td><td>{resident.unit_address}</td><td><Badge value={resident.dues_status} /></td><td><Badge value={resident.access_status} /></td><td>{formatTimestamp(resident.last_synced_at)}</td></tr>)}{residents.length === 0 ? <tr><td colSpan={5}>No residents found. Run the Supabase migration and seed data, or add residents in Supabase.</td></tr> : null}</tbody></table><h2>Pending human-in-the-loop cards</h2>{tasks.length > 0 ? tasks.map((task) => <div className="card" key={task.id}><strong>{task.action} via {task.provider}</strong><p>{task.instructions}</p></div>) : <div className="card"><strong>No pending manual tasks</strong><p>Manual AirAllow or Vantaca actions will appear here when reconciliation creates them.</p></div>}</main>;
}
