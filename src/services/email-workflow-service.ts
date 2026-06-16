import type { LearnedClassification } from "@/services/request-learning-service";
import { classifyWithLearning } from "@/services/request-learning-service";
import { isAccFormEmail } from "@/domain/request-classifier";
import { SupabaseAuditSink } from "@/services/audit-service";
import type { TriageRequest } from "@/domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type InboundEmailWorkflowInput = {
  messageId?: string;
  source?: string;
  request: TriageRequest;
  rawBodyText: string;
};

type WorkflowResult = {
  requestId: string;
  messageId: string;
  classification: LearnedClassification;
  taskCreated: boolean;
  duplicate: boolean;
  accRequestId: string | null;
};

const actionInstructions = {
  emergency_response: "Contact the responsible board member or vendor immediately, then update the request status.",
  access_follow_up: "Review resident access details, dues context, and any AirAllow manual task before responding.",
  facility_repair: "Assign or contact the appropriate facility/vendor owner and track the repair response.",
  vendor_follow_up: "Review vendor communication, attach any needed documents, and assign the board owner.",
  invoice_review: "Review invoice/payment details and route to the treasurer or management company.",
  board_review: "Review and categorize this email before assigning the next action."
} as const;

function fallbackMessageId(input: InboundEmailWorkflowInput) {
  const digest = createHash("sha256")
    .update(input.request.fromEmail)
    .update(input.request.subject)
    .update(input.request.bodyText)
    .update(input.request.receivedAt)
    .digest("hex");
  return `derived:${digest}`;
}

async function createWorkflowTask(supabase: SupabaseClient, requestId: string, classification: LearnedClassification, auditId: string | null) {
  const instructions = `${actionInstructions[classification.actionNeeded]} Request ID: ${requestId}.`;
  const { error } = await supabase.from("manual_tasks").insert({
    provider: "email-workflow",
    resident_id: null,
    action: classification.actionNeeded,
    instructions,
    created_by_audit_id: auditId
  });
  if (error) throw error;
}

async function createAccRequest(supabase: SupabaseClient, input: InboundEmailWorkflowInput, requestId: string, messageId: string) {
  const { data, error } = await supabase
    .from("acc_requests")
    .insert({
      request_id: requestId,
      external_message_id: messageId,
      from_email: input.request.fromEmail,
      subject: input.request.subject,
      body_text: input.rawBodyText,
      sanitized_body: input.request.bodyText,
      received_at: input.request.receivedAt,
      source: input.source ?? "email-webhook"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function startEmailWorkflow(supabase: SupabaseClient, input: InboundEmailWorkflowInput): Promise<WorkflowResult> {
  const messageId = input.messageId?.trim() || fallbackMessageId(input);
  const classification = await classifyWithLearning(supabase, input.request);
  const accFormEmail = isAccFormEmail(input.request);
  const existing = await supabase.from("requests").select("id").eq("external_message_id", messageId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const accExisting = accFormEmail
      ? await supabase.from("acc_requests").select("id").eq("request_id", existing.data.id).maybeSingle()
      : { data: null, error: null };
    if (accExisting.error) throw accExisting.error;
    return { requestId: existing.data.id, messageId, classification, taskCreated: false, duplicate: true, accRequestId: accExisting.data?.id ?? null };
  }

  const { data, error } = await supabase
    .from("requests")
    .insert({
      from_email: input.request.fromEmail,
      subject: input.request.subject,
      body_text: input.rawBodyText,
      sanitized_body: input.request.bodyText,
      category: classification.category,
      priority: classification.priority,
      action_needed: classification.actionNeeded,
      classification_reason: classification.reason,
      category_confidence: classification.confidence,
      categorization_note: classification.note,
      needs_category_review: classification.needsReview,
      received_at: input.request.receivedAt,
      inbound_source: input.source ?? "email-webhook",
      external_message_id: messageId,
      workflow_started_at: new Date().toISOString()
    })
    .select("id")
    .single();
  if (error) throw error;

  const accRequestId = accFormEmail ? await createAccRequest(supabase, input, data.id, messageId) : null;

  const audit = await new SupabaseAuditSink(supabase).append({
    actor: { type: "system", id: "system" },
    action: "email.workflow_started",
    reason: `Inbound email started ${classification.actionNeeded} workflow.`,
    before: {},
    after: { requestId: data.id, messageId, classification, accRequestId },
    idempotencyKey: `email:${messageId}:workflow`
  });
  await createWorkflowTask(supabase, data.id, classification, audit.id);
  return { requestId: data.id, messageId, classification, taskCreated: true, duplicate: false, accRequestId };
}
