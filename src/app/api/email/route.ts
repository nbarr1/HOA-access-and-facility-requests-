import type { TriageRequest } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { reconcileSentEmailAction, startEmailWorkflow } from "@/services/email-workflow-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const inboundEmailSchema = z.object({
  direction: z.literal("inbound").default("inbound"),
  messageId: z.string().min(1).max(500).optional(),
  source: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email(),
  subject: z.string().min(1).max(250),
  bodyText: z.string().max(20_000).default(""),
  receivedAt: z.string().optional()
});

const sentEmailSchema = z.object({
  direction: z.literal("sent"),
  messageId: z.string().min(1).max(500).optional(),
  source: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email(),
  toEmails: z.array(z.string().email()).min(1).max(50),
  subject: z.string().min(1).max(250),
  bodyText: z.string().max(20_000).default(""),
  sentAt: z.string().optional(),
  inReplyTo: z.string().min(1).max(500).optional(),
  references: z.array(z.string().min(1).max(500)).max(50).optional()
});

const emailWebhookSchema = z.union([sentEmailSchema, inboundEmailSchema]);

function sanitizeEmailText(value: string): string {
  return value.replace(/<[a-zA-Z/][^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10_000);
}

function emailSecretFromRequest(request: NextRequest) {
  const explicitHeader = request.headers.get("x-hoa-email-secret")?.trim();
  const authorization = request.headers.get("authorization")?.trim();
  const bearer = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : undefined;
  return explicitHeader || bearer || "";
}

function normalizeTimestamp(value: string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "Internal Server Error: Email secret not configured" }, { status: 500 });
  }
  const receivedSecret = emailSecretFromRequest(request);
  if (receivedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = emailWebhookSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = createSupabaseServiceClient();

  if (parsed.data.direction === "sent") {
    const sentAt = normalizeTimestamp(parsed.data.sentAt);
    const workflow = await reconcileSentEmailAction(supabase, {
      messageId: parsed.data.messageId,
      source: parsed.data.source,
      fromEmail: parsed.data.fromEmail,
      toEmails: parsed.data.toEmails,
      subject: sanitizeEmailText(parsed.data.subject),
      bodyText: sanitizeEmailText(parsed.data.bodyText),
      sentAt,
      inReplyTo: parsed.data.inReplyTo,
      references: parsed.data.references
    });

    return NextResponse.json({
      messageId: workflow.messageId,
      matched: workflow.matched,
      requestId: workflow.requestId,
      previousStatus: workflow.previousStatus,
      status: workflow.status,
      actionTaken: workflow.actionTaken,
      manualTaskCompleted: workflow.manualTaskCompleted
    }, { status: workflow.matched ? 200 : 202 });
  }

  const triageRequest: TriageRequest = {
    fromEmail: parsed.data.fromEmail,
    subject: sanitizeEmailText(parsed.data.subject),
    bodyText: sanitizeEmailText(parsed.data.bodyText),
    receivedAt: normalizeTimestamp(parsed.data.receivedAt)
  };
  const workflow = await startEmailWorkflow(supabase, {
    messageId: parsed.data.messageId,
    source: parsed.data.source,
    request: triageRequest,
    rawBodyText: parsed.data.bodyText
  });

  return NextResponse.json({
    id: workflow.requestId,
    messageId: workflow.messageId,
    request: triageRequest,
    classification: workflow.classification,
    persisted: true,
    workflowStarted: !workflow.duplicate,
    taskCreated: workflow.taskCreated,
    accRequestId: workflow.accRequestId,
    duplicate: workflow.duplicate
  }, { status: workflow.duplicate ? 200 : 201 });
}
