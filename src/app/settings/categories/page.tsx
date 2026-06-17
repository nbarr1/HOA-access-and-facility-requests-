import { saveCategorizationRule } from "@/app/actions/request-actions";
import { Badge } from "@/components/Badge";
import { requestActionOptions, requestCategoryOptions, requestPriorityOptions } from "@/domain/categorization-rules";
import { requireBoardUser } from "@/lib/navigation-auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getCategorizationRules } from "@/services/categorization-rules-service";
import Link from "next/link";

export const dynamic = "force-dynamic";

const actionLabels = {
  emergency_response: "Emergency response",
  access_follow_up: "Access follow-up",
  facility_repair: "Facility repair",
  vendor_follow_up: "Vendor follow-up",
  invoice_review: "Invoice review",
  board_review: "Board review"
} as const;

export default async function CategorySettingsPage() {
  await requireBoardUser();
  const supabase = createSupabaseServiceClient();
  const [rules, audit] = await Promise.all([
    getCategorizationRules(supabase),
    supabase.from("audit_log").select("id,actor_name,action,reason,created_at,after_state").in("action", ["categorization_rule.created", "categorization_rule.updated"]).order("created_at", { ascending: false }).limit(15)
  ]);

  return <main><section className="hero"><div><h1>Category and rule settings</h1><p>Safely maintain the keywords that explain how incoming HOA emails are categorized, prioritized, and routed.</p></div><Link className="button-link" href="/triage">Back to triage</Link></section>{audit.error ? <div className="card"><strong>Unable to load rule audit log</strong><p>{audit.error.message}</p></div> : null}<section className="grid"><div className="card"><h2>{rules.filter((rule) => rule.isActive).length}</h2><p>Active rules</p></div><div className="card"><h2>{rules.filter((rule) => rule.kind === "category").length}</h2><p>Category rules</p></div><div className="card"><h2>{rules.filter((rule) => rule.kind === "priority").length}</h2><p>Priority rules</p></div></section><h2>Add a rule</h2><form className="card rule-form" action={saveCategorizationRule}><label>Rule type<select name="kind" defaultValue="category"><option value="category">Category</option><option value="priority">Priority</option></select></label><label>Label<input name="label" placeholder="Pool gate access" required /></label><label>Keywords / pattern<input name="pattern" placeholder="pool gate|gate code|fob" required /></label><label>Category<select name="category" defaultValue="other"><option value="">No category</option>{requestCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>Priority<select name="priority" defaultValue="normal"><option value="">No priority</option>{requestPriorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Action<select name="action_needed" defaultValue="board_review"><option value="">Default action</option>{requestActionOptions.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}</select></label><label>Notes<textarea name="notes" placeholder="Explain when this rule should match." /></label><label className="check-label"><input type="checkbox" name="is_active" defaultChecked /> Active</label><button type="submit">Add rule</button></form><h2>Current rules</h2><div className="rule-list">{rules.map((rule) => <form className="card rule-form" action={saveCategorizationRule} key={rule.id ?? rule.label}><input type="hidden" name="id" value={rule.id ?? ""} /><label>Rule type<select name="kind" defaultValue={rule.kind}><option value="category">Category</option><option value="priority">Priority</option></select></label><label>Label<input name="label" defaultValue={rule.label} required /></label><label>Keywords / pattern<input name="pattern" defaultValue={rule.pattern} required /></label><label>Category<select name="category" defaultValue={rule.category ?? ""}><option value="">No category</option>{requestCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><label>Priority<select name="priority" defaultValue={rule.priority ?? ""}><option value="">No priority</option>{requestPriorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Action<select name="action_needed" defaultValue={rule.actionNeeded ?? ""}><option value="">Default action</option>{requestActionOptions.map((action) => <option key={action} value={action}>{actionLabels[action]}</option>)}</select></label><label>Notes<textarea name="notes" defaultValue={rule.notes} /></label><label className="check-label"><input type="checkbox" name="is_active" defaultChecked={rule.isActive} /> Active</label><div><Badge value={rule.kind} /> {rule.category ? <Badge value={rule.category} /> : null} {rule.priority ? <Badge value={rule.priority} /> : null}</div><button type="submit">Save rule</button></form>)}</div><h2>Rule audit log</h2><table className="table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Reason</th></tr></thead><tbody>{(audit.data ?? []).map((entry) => <tr key={entry.id}><td>{new Date(entry.created_at).toLocaleString()}</td><td>{entry.actor_name}</td><td>{entry.action}</td><td>{entry.reason}</td></tr>)}{(audit.data ?? []).length === 0 ? <tr><td colSpan={4}>Rule changes will appear here after edits are saved.</td></tr> : null}</tbody></table></main>;
}
