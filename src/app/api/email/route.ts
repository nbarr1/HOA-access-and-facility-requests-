import { RuleBasedRequestClassifier } from "@/domain/request-classifier";
import type { TriageRequest } from "@/domain/types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const inboundEmailSchema = z.object({
  fromEmail: z.string().email(),
  subject: z.string().min(1).max(250),
  bodyText: z.string().max(20_000).default(""),
  receivedAt: z.string().datetime().optional()
});

function sanitizeEmailText(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 10_000);
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (configuredSecret && request.headers.get("x-hoa-email-secret") !== configuredSecret) {
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
  const classification = new RuleBasedRequestClassifier().classify(triageRequest);

  return NextResponse.json({ request: triageRequest, classification, persisted: false, note: "Wire this route to Supabase service client in deployment." }, { status: 202 });
}
