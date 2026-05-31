import { ManualTaskBillingAdapter } from "@/adapters/manual-task-billing-adapter";
import { VantacaApiBillingAdapter } from "@/adapters/vantaca-api-adapter";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (configuredSecret && request.headers.get("x-hoa-sync-secret") !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const billingProvider = process.env.VANTACA_ADAPTER === "api"
    ? new VantacaApiBillingAdapter(process.env.VANTACA_API_BASE_URL ?? "", process.env.VANTACA_API_TOKEN ?? "")
    : new ManualTaskBillingAdapter();
  const statuses = await billingProvider.fetchDuesStatuses();
  return NextResponse.json({ received: statuses.length, mode: process.env.VANTACA_ADAPTER ?? "manual", note: "Reconciliation service consumes these records in production." });
}
