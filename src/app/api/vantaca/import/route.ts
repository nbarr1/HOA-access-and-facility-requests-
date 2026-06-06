import type { DuesStatus } from "@/domain/types";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";

const importRecordSchema = z.object({
  externalBillingId: z.string().optional().default(""),
  unitAddress: z.string().optional().default(""),
  residentName: z.string().optional().default(""),
  email: z.string().email().optional(),
  balance: z.union([z.number(), z.string()]),
  balanceReference: z.string().optional().default(""),
  asOf: z.string().optional()
});

const jsonImportSchema = z.object({ records: z.array(importRecordSchema).min(1) });

type ImportRecord = z.infer<typeof importRecordSchema>;

function parseBalance(value: string | number) {
  if (typeof value === "number") return value;
  const normalized = value.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid balance: ${value}`);
  return parsed;
}

function duesStatusForBalance(balance: number): DuesStatus {
  return balance > 0 ? "lapsed" : "paid";
}

function csvCell(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): ImportRecord[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvCell(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return lines.slice(1).map((line) => {
    const cells = csvCell(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return importRecordSchema.parse({
      externalBillingId: row.externalbillingid || row.accountid || row.account || row.vantacaid,
      unitAddress: row.unitaddress || row.address || row.propertyaddress,
      residentName: row.residentname || row.name || row.owner,
      email: row.email || undefined,
      balance: row.balance || row.amountdue || row.totaldue || "0",
      balanceReference: row.balancereference || row.statement || row.report || "",
      asOf: row.asof || row.date || undefined
    });
  });
}

function importKey(record: ImportRecord, balance: number, asOf: string) {
  const identity = record.externalBillingId || record.email || record.unitAddress || record.residentName;
  return ["vantaca", identity, balance.toFixed(2), record.balanceReference, asOf].join(":");
}

async function findMatchedResidentId(record: ImportRecord) {
  const supabase = createSupabaseServiceClient();
  const query = supabase.from("residents").select("id").limit(1);
  if (record.externalBillingId) return query.eq("external_billing_id", record.externalBillingId).maybeSingle();
  if (record.email) return query.eq("email", record.email).maybeSingle();
  if (record.unitAddress) return query.eq("unit_address", record.unitAddress).maybeSingle();
  return { data: null, error: null };
}

export async function POST(request: Request) {
  const configuredSecret = process.env.INBOUND_EMAIL_SHARED_SECRET;
  if (!configuredSecret) return NextResponse.json({ error: "Internal Server Error: Import secret not configured" }, { status: 500 });
  if (request.headers.get("x-hoa-sync-secret") !== configuredSecret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const records = contentType.includes("application/json")
    ? jsonImportSchema.parse(await request.json()).records
    : parseCsv(await request.text());
  if (records.length === 0) return NextResponse.json({ error: "No import records found" }, { status: 400 });

  const supabase = createSupabaseServiceClient();
  const asOfDefault = new Date().toISOString();
  const rows = [];
  for (const record of records) {
    const balance = parseBalance(record.balance);
    const asOf = record.asOf ?? asOfDefault;
    const match = await findMatchedResidentId(record);
    if (match.error) return NextResponse.json({ error: match.error.message }, { status: 500 });
    rows.push({
      import_key: importKey(record, balance, asOf),
      external_billing_id: record.externalBillingId || null,
      unit_address: record.unitAddress || null,
      resident_name: record.residentName || null,
      email: record.email ?? null,
      balance,
      dues_status: duesStatusForBalance(balance),
      balance_reference: record.balanceReference || "",
      source: "manual-import",
      matched_resident_id: match.data?.id ?? null,
      status: "pending"
    });
  }

  const { data, error } = await supabase
    .from("vantaca_balance_reviews")
    .upsert(rows, { onConflict: "import_key" })
    .select("id,status,matched_resident_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    imported: data.length,
    matched: data.filter((row) => row.matched_resident_id).length,
    pending: data.filter((row) => row.status === "pending").length
  }, { status: 201 });
}
