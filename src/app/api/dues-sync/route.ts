import { ManualTaskBillingAdapter } from "@/adapters/manual-task-billing-adapter";
import { VantacaApiBillingAdapter } from "@/adapters/vantaca-api-adapter";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { reconcileBillingStatus } from "@/services/dues-reconciliation-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "Internal Server Error: Sync secret not configured" }, { status: 500 });
  }
  if (request.headers.get("x-hoa-sync-secret") !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const billingProvider = process.env.VANTACA_ADAPTER === "api"
    ? new VantacaApiBillingAdapter(process.env.VANTACA_API_BASE_URL ?? "", process.env.VANTACA_API_TOKEN ?? "")
    : new ManualTaskBillingAdapter();
  const statuses = await billingProvider.fetchDuesStatuses();
  const results = await Promise.all(statuses.map((statusRecord) => reconcileBillingStatus(supabase, statusRecord)));

  return NextResponse.json({
    received: statuses.length,
    mode: process.env.VANTACA_ADAPTER ?? "manual",
    accessMode: process.env.AIRALLOW_ADAPTER ?? "manual",
    matched: results.filter((result) => result.status !== "unmatched" && result.status !== "error").length,
    unmatched: results.filter((result) => result.status === "unmatched").length,
    errors: results.filter((result) => result.status === "error").length,
    results
  });
}
