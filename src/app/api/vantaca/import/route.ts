import { createSupabaseServiceClient } from "@/lib/supabase";
import { jsonImportSchema, parseVantacaCsv, stageVantacaImport } from "@/services/vantaca-import-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (!configuredSecret) return NextResponse.json({ error: "Internal Server Error: Import secret not configured" }, { status: 500 });
  if (request.headers.get("x-hoa-sync-secret") !== configuredSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const records = contentType.includes("application/json")
    ? jsonImportSchema.parse(await request.json()).records
    : parseVantacaCsv(await request.text());
  if (records.length === 0) return NextResponse.json({ error: "No import records found" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const result = await stageVantacaImport(supabase, records);
  return NextResponse.json(result, { status: 201 });
}
