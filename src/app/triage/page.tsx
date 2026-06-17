import { updateRequestTriage } from "@/app/actions/request-actions";
import { Badge } from "@/components/Badge";
import { requestActionOptions, requestCategoryOptions, requestPriorityOptions, requestStatusOptions } from "@/domain/categorization-rules";
import type { RequestActionNeeded, RequestCategory, RequestPriority, RequestStatus } from "@/domain/types";
import { requireBoardUser } from "@/lib/navigation-auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getCategorizationRulesResult } from "@/services/categorization-rules-service";
import Link from "next/link";

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

type SearchParams = { status?: string; category?: string; priority?: string; review?: string; q?: string };

type RequestRow = {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  action_needed: RequestActionNeeded;
  subject: string;
  from_email: string;
  sanitized_body: string;
  classification_reason: string;
  categorization_note: string;
  category_confidence: number;
  needs_category_review: boolean;
  received_at: string;
};

function option(value: string | undefined, expected: string) {
  return value === expected ? expected : undefined;
}

export default async function TriagePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireBoardUser();
  const filters = await searchParams;
  const supabase = createSupabaseServiceClient();
  let query = supabase.from("requests").select("id,category,priority,status,action_needed,subject,from_email,sanitized_body,classification_reason,categorization_note,category_confidence,needs_category_review,received_at").order("received_at", { ascending: false }).limit(100);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.review === "yes") query = query.eq("needs_category_review", true);
  if (filters.q) query = query.or(`subject.ilike.%${filters.q}%,from_email.ilike.%${filters.q}%,sanitized_body.ilike.%${filters.q}%`);
  const [{ data, error }, rulesResult] = await Promise.all([query, getCategorizationRulesResult(supabase, true)]);
  const rules = rulesResult.rules;
  const sorted = ((data ?? []) as RequestRow[]).sort((a, b) => weight[a.priority] - weight[b.priority]);

  return <main><section className="hero"><div><h1>All received emails and requests</h1><p>Every accepted inbound email appears here. Filter, review, recategorize, update status, and close line items from this working inbox.</p></div><Link className="button-link" href="/settings/categories">Manage categorization rules</Link></section>{error ? <div className="card"><strong>Unable to load requests</strong><p>{error.message}</p></div> : null}<form className="filter-bar"><input name="q" placeholder="Search sender, subject, or body" defaultValue={filters.q ?? ""} /><select name="status" defaultValue={option(filters.status, filters.status ?? "") ?? ""}><option value="">All statuses</option>{requestStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select><select name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>{requestCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option>{requestPriorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select name="review" defaultValue={filters.review ?? ""}><option value="">Any review state</option><option value="yes">Needs review</option></select><button type="submit">Apply filters</button><Link href="/triage">Clear</Link></form>{rulesResult.warning ? <div className="card warning-card"><strong>Default rules are being used</strong><p>{rulesResult.warning}</p></div> : null}<details className="card rules-panel"><summary>How categorization works</summary><p>The system checks active keyword rules, then applies board corrections from prior edits before falling back to board review for unclear emails.</p><div className="grid rules-grid">{rules.map((rule) => <div className="rule-card" key={rule.id ?? rule.label}><strong>{rule.label}</strong><small>{rule.kind} rule</small><code>{rule.pattern}</code><p>{rule.category ? `Category: ${rule.category}. ` : ""}{rule.priority ? `Priority: ${rule.priority}. ` : ""}{rule.actionNeeded ? `Action: ${actionLabels[rule.actionNeeded]}.` : ""}</p></div>)}</div></details><p><strong>{sorted.length}</strong> request rows shown. Filters currently show the newest 100 matching emails.</p><table className="table"><thead><tr><th>Request</th><th>Current result</th><th>Board edits</th><th>Status</th><th>Details</th><th></th></tr></thead><tbody>{sorted.map((request) => <tr key={request.id}><td className="email-context-cell"><strong>{request.subject}</strong><br /><small>{request.from_email}</small><br /><small>{new Date(request.received_at).toLocaleString()}</small></td><td><Badge value={request.priority} /> <Badge value={request.category} /><br /><small>{actionLabels[request.action_needed]}</small><br /><small>{Math.round(Number(request.category_confidence) * 100)}% confidence</small>{request.needs_category_review ? <><br /><Badge value="needs review" /></> : null}</td><td><form id={`triage-${request.id}`} action={updateRequestTriage}><input type="hidden" name="id" value={request.id} /><select name="category" defaultValue={request.category}>{requestCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select><select name="priority" defaultValue={request.priority}>{requestPriorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><select name="action_needed" defaultValue={request.action_needed}>{requestActionOptions.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}</select><label className="check-label"><input type="checkbox" name="needs_category_review" defaultChecked={request.needs_category_review} /> Needs review</label></form></td><td><select form={`triage-${request.id}`} name="status" defaultValue={request.status}>{requestStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></td><td><details><summary>View email</summary><p><strong>Classifier reason:</strong> {request.classification_reason || "No reason recorded."}</p><p><strong>Note:</strong> {request.categorization_note || "No note recorded."}</p><pre className="email-body">{request.sanitized_body || "No email body available."}</pre></details></td><td><button form={`triage-${request.id}`} type="submit">Save</button></td></tr>)}{sorted.length === 0 ? <tr><td colSpan={6}>No requests found. Inbound email records will appear here after `/api/email` persists them.</td></tr> : null}</tbody></table></main>;
}
