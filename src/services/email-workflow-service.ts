import type { LearnedClassification } from "@/services/request-learning-service";
import { classifyWithLearning } from "@/services/request-learning-service";
import { isAccFormEmail } from "@/domain/request-classifier";
import { SupabaseAuditSink } from "@/services/audit-service";
import type { RequestStatus, TriageRequest } from "@/domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export type InboundEmailWorkflowInput = {
  messageId?: string;
  source?: string;
  request: TriageRequest;
  rawBodyText: string;
};

export type SentEmailWorkflowInput = {
  messageId?: string;
  source?: string;
  fromEmail: string;
  toEmails: string[];
  subject: string;
  bodyText: string;
  sentAt: string;
  inReplyTo?: string;
  references?: string[];
};

type WorkflowResult = {
  requestId: string;
  messageId: string;
  classification: LearnedClassification;
  taskCreated: boolean;
  duplicate: boolean;
  accRequestId: string | null;
};

export type SentEmailActionResult = {
  messageId: string;
  matched: boolean;
  requestId: string | null;
  previousStatus: RequestStatus | null;
  status: RequestStatus | null;
  actionTaken: "reply_sent" | "completion_indicated" | "no_match";
  manualTaskCompleted: boolean;
};

type MatchedRequest = {
  id: string;
  status: RequestStatus;
  subject: string;
  action_needed: string;
  external_message_id: string | null;
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

function fallbackSentMessageId(input: SentEmailWorkflowInput) {
  const digest = createHash("sha256")
    .update(input.fromEmail)
    .update(input.toEmails.join(","))
    .update(input.subject)
    .update(input.bodyText)
    .update(input.sentAt)
    .digest("hex");
  return `sent-derived:${digest}`;
}

export function normalizeThreadSubject(subject: string) {
  return subject.replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function referencedMessageIds(input: Pick<SentEmailWorkflowInput, "inReplyTo" | "references">) {
  return Array.from(new Set([input.inReplyTo, ...(input.references ?? [])].map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function inferSentEmailAction(bodyText: string): Pick<SentEmailActionResult, "actionTaken" | "status"> {
  const text = bodyText.toLowerCase();
  const completionPattern = /\b(approved|denied|completed|complete|resolved|handled|closed|fixed|submitted|sent to vendor|scheduled)\b/;
  if (completionPattern.test(text)) return { actionTaken: "completion_indicated", status: "done" };
  return { actionTaken: "reply_sent", status: "in_progress" };
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

async function findRequestForSentEmail(supabase: SupabaseClient, input: SentEmailWorkflowInput): Promise<MatchedRequest | null> {
  const messageIds = referencedMessageIds(input);
  if (messageIds.length > 0) {
    const { data, error } = await supabase
      .from("requests")
      .select("id,status,subject,action_needed,external_message_id")
      .in("external_message_id", messageIds)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as MatchedRequest;
  }

  const normalizedSubject = normalizeThreadSubject(input.subject);
  if (!normalizedSubject) return null;
  const { data, error } = await supabase
    .from("requests")
    .select("id,status,subject,action_needed,external_message_id")
    .ilike("subject", `%${normalizedSubject.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`)
    .order("received_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as MatchedRequest[] | null)?.find((row) => normalizeThreadSubject(row.subject) === normalizedSubject) ?? null;
}

export async function reconcileSentEmailAction(supabase: SupabaseClient, input: SentEmailWorkflowInput): Promise<SentEmailActionResult> {
  const messageId = input.messageId?.trim() || fallbackSentMessageId(input);
  const existing = await supabase.from("sent_email_actions").select("request_id,resulting_status,action_taken").eq("external_message_id", messageId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    return {
      messageId,
      matched: Boolean(existing.data.request_id),
      requestId: existing.data.request_id ?? null,
      previousStatus: null,
      status: existing.data.resulting_status ?? null,
      actionTaken: existing.data.action_taken ?? "no_match",
      manualTaskCompleted: false
    };
  }

  const matchedRequest = await findRequestForSentEmail(supabase, input);
  const inferred = inferSentEmailAction(input.bodyText);
  if (!matchedRequest) {
    const { error } = await supabase.from("sent_email_actions").insert({
      external_message_id: messageId,
      source: input.source ?? "sent-email-webhook",
      from_email: input.fromEmail,
      to_emails: input.toEmails,
      subject: input.subject,
      body_text: input.bodyText,
      sent_at: input.sentAt,
      in_reply_to: input.inReplyTo ?? null,
      reference_ids: referencedMessageIds(input),
      action_taken: "no_match",
      resulting_status: null
    });
    if (error) throw error;
    return { messageId, matched: false, requestId: null, previousStatus: null, status: null, actionTaken: "no_match", manualTaskCompleted: false };
  }

  const nextStatus = matchedRequest.status === "done" ? matchedRequest.status : inferred.status;
  const taskUpdate = await supabase
    .from("manual_tasks")
    .update({ status: "done", completed_at: input.sentAt })
    .eq("provider", "email-workflow")
    .eq("action", matchedRequest.action_needed)
    .eq("status", "pending")
    .ilike("instructions", `%Request ID: ${matchedRequest.id}.%`)
    .select("id");
  if (taskUpdate.error) throw taskUpdate.error;

  const { error: requestError } = await supabase.from("requests").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", matchedRequest.id);
  if (requestError) throw requestError;

  const { error: sentError } = await supabase.from("sent_email_actions").insert({
    request_id: matchedRequest.id,
    external_message_id: messageId,
    source: input.source ?? "sent-email-webhook",
    from_email: input.fromEmail,
    to_emails: input.toEmails,
    subject: input.subject,
    body_text: input.bodyText,
    sent_at: input.sentAt,
    in_reply_to: input.inReplyTo ?? null,
    references: referencedMessageIds(input),
    action_taken: inferred.actionTaken,
    resulting_status: nextStatus
  });
  if (sentError) throw sentError;

  await new SupabaseAuditSink(supabase).append({
    actor: { type: "system", id: "system" },
    action: "email.sent_action_detected",
    reason: `Sent email ${inferred.actionTaken === "completion_indicated" ? "indicated completion" : "showed direct account activity"} for request ${matchedRequest.id}.`,
    before: { requestId: matchedRequest.id, status: matchedRequest.status },
    after: { requestId: matchedRequest.id, messageId, status: nextStatus, actionTaken: inferred.actionTaken, manualTaskIds: taskUpdate.data?.map((task: { id: string }) => task.id) ?? [] },
    idempotencyKey: `sent-email:${messageId}:action`
  });

  return {
    messageId,
    matched: true,
    requestId: matchedRequest.id,
    previousStatus: matchedRequest.status,
    status: nextStatus,
    actionTaken: inferred.actionTaken,
    manualTaskCompleted: Boolean(taskUpdate.data?.length)
  };
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
