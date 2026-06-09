import type { TriageRequest } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { classifyWithLearning } from "@/services/request-learning-service";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const inboundEmailSchema = z.object({
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
  const classification = await classifyWithLearning(supabase, triageRequest);
  const { data, error } = await supabase
    .from("requests")
    .insert({
      from_email: triageRequest.fromEmail,
      subject: triageRequest.subject,
      body_text: parsed.data.bodyText,
      sanitized_body: triageRequest.bodyText,
      category: classification.category,
      priority: classification.priority,
      action_needed: classification.actionNeeded,
      classification_reason: classification.reason,
      category_confidence: classification.confidence,
      categorization_note: classification.note,
      needs_category_review: classification.needsReview,
      received_at: triageRequest.receivedAt
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id, request: triageRequest, classification, persisted: true }, { status: 201 });
}
