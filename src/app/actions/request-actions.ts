"use server";

import { validateRuleInput } from "@/domain/categorization-rules";
import type { RequestActionNeeded, RequestCategory, RequestPriority, RequestStatus } from "@/domain/types";
import { getCurrentUserId, requireBoardUser } from "@/lib/navigation-auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { SupabaseAuditSink } from "@/services/audit-service";
import { tokensForRequest } from "@/services/request-learning-service";
import { revalidatePath } from "next/cache";

async function actor() {
  const id = await getCurrentUserId();
  if (!id) return { type: "system" as const, id: "system" as const };
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase.from("profiles").select("full_name").eq("id", id).maybeSingle<{ full_name: string }>();
  return { type: "user" as const, id, name: data?.full_name ?? "Board user" };
}

export async function updateRequestTriage(formData: FormData) {
  await requireBoardUser();
  const id = String(formData.get("id") ?? "");
  const category = String(formData.get("category") ?? "other") as RequestCategory;
  const priority = String(formData.get("priority") ?? "normal") as RequestPriority;
  const actionNeeded = String(formData.get("action_needed") ?? "board_review") as RequestActionNeeded;
  const status = String(formData.get("status") ?? "new") as RequestStatus;
  const needsReview = formData.get("needs_category_review") === "on";
  const supabase = createSupabaseServiceClient();
  const current = await supabase.from("requests").select("id,category,priority,action_needed,status,subject,sanitized_body,from_email,needs_category_review").eq("id", id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw new Error("Request not found.");

  const requestTokens = tokensForRequest({ fromEmail: current.data.from_email, subject: current.data.subject, bodyText: current.data.sanitized_body });
  const next = {
    category,
    priority,
    action_needed: actionNeeded,
    status,
    category_confidence: 1,
    needs_category_review: needsReview,
    categorization_note: needsReview ? "Board flagged this email for another category review." : "Board-reviewed category. This correction was added to the learning set.",
    classification_reason: `Board recategorized from ${current.data.category}/${current.data.priority}/${current.data.action_needed}.`,
    updated_at: new Date().toISOString()
  };
  const update = await supabase.from("requests").update(next).eq("id", id);
  if (update.error) throw update.error;

  if (category !== current.data.category || priority !== current.data.priority || actionNeeded !== current.data.action_needed) {
    const feedback = await supabase.from("request_classification_feedback").insert({
      request_id: id,
      from_category: current.data.category,
      to_category: category,
      from_priority: current.data.priority,
      to_priority: priority,
      from_action_needed: current.data.action_needed,
      to_action_needed: actionNeeded,
      subject: current.data.subject,
      sanitized_body: current.data.sanitized_body,
      tokens: requestTokens
    });
    if (feedback.error) throw feedback.error;
  }

  await new SupabaseAuditSink(supabase).append({
    actor: await actor(),
    action: "request.triage_updated",
    reason: "Board updated request triage fields from the working inbox.",
    before: current.data,
    after: next,
    idempotencyKey: `request:${id}:triage:${Date.now()}`
  });
  revalidatePath("/dashboard");
  revalidatePath("/triage");
}

export async function saveCategorizationRule(formData: FormData) {
  await requireBoardUser();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "category") as "priority" | "category";
  const label = String(formData.get("label") ?? "");
  const pattern = String(formData.get("pattern") ?? "");
  const category = (String(formData.get("category") ?? "") || null) as RequestCategory | null;
  const priority = (String(formData.get("priority") ?? "") || null) as RequestPriority | null;
  const actionNeeded = (String(formData.get("action_needed") ?? "") || null) as RequestActionNeeded | null;
  const notes = String(formData.get("notes") ?? "");
  const isActive = formData.get("is_active") === "on";
  validateRuleInput({ kind, label, pattern, category, priority, actionNeeded });
  const supabase = createSupabaseServiceClient();
  const before = id ? await supabase.from("request_categorization_rules").select("*").eq("id", id).maybeSingle() : { data: null, error: null };
  if (before.error) throw before.error;
  const payload = { kind, label: label.trim(), pattern: pattern.trim(), category: kind === "category" ? category : null, priority: kind === "priority" ? priority : null, action_needed: actionNeeded, notes: notes.trim(), is_active: isActive, updated_at: new Date().toISOString() };
  const result = id ? await supabase.from("request_categorization_rules").update(payload).eq("id", id) : await supabase.from("request_categorization_rules").insert(payload);
  if (result.error) throw result.error;
  await new SupabaseAuditSink(supabase).append({ actor: await actor(), action: id ? "categorization_rule.updated" : "categorization_rule.created", reason: "Board changed email categorization rules.", before: before.data ?? {}, after: payload, idempotencyKey: `rule:${id || label}:${Date.now()}` });
  revalidatePath("/settings/categories");
  revalidatePath("/triage");
}
