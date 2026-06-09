import type { TriageRequest } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { startEmailWorkflow } from "@/services/email-workflow-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const inboundEmailSchema = z.object({
  messageId: z.string().min(1).max(500).optional(),
  source: z.string().min(1).max(100).optional(),
  fromEmail: z.string().email(),
  subject: z.string().min(1).max(250),
  bodyText: z.string().max(20_000).default(""),
  receivedAt: z.string().datetime().optional()
});

function sanitizeEmailText(value: string): string {
  return value.replace(/<[a-zA-Z/][^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10_000);
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "Internal Server Error: Email secret not configured" }, { status: 500 });
  }
  if (request.headers.get("x-hoa-email-secret") !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = inboundEmailSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const triageRequest: TriageRequest = {
    fromEmail: parsed.data.fromEmail,
    subject: sanitizeEmailText(parsed.data.subject),
    bodyText: sanitizeEmailText(parsed.data.bodyText),
    receivedAt: parsed.data.receivedAt ?? new Date().toISOString()
  };
  const supabase = createSupabaseServiceClient();
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
    duplicate: workflow.duplicate
  }, { status: workflow.duplicate ? 200 : 201 });
}
