import type { DuesStatus } from "@/domain/types";
import { normalizeUnitAddress } from "@/lib/address-normalization";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export const jsonImportSchema = z.object({ records: z.array(importRecordSchema).min(1) });

export type VantacaImportRecord = z.infer<typeof importRecordSchema>;

type ResidentMatchRow = {
  id: string;
  unit_address: string;
  external_billing_id: string | null;
  email: string;
};

export function parseBalance(value: string | number) {
  if (typeof value === "number") return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return 0;
  const isAccountingNegative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed
    .replace(/\b(cr|credit)\b/i, "")
    .replace(/[()$,\s]/g, "")
    .trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid balance: ${value}`);
  return isAccountingNegative ? -parsed : parsed;
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

export function parseVantacaCsv(text: string): VantacaImportRecord[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = csvCell(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return lines.slice(1).map((line, index) => {
    const cells = csvCell(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    try {
      const record = importRecordSchema.parse({
        externalBillingId: row.externalbillingid || row.accountid || row.account || row.accountnumber || row.vantacaid,
        unitAddress: row.unitaddress || row.address || row.propertyaddress || row.homeaddress,
        residentName: row.residentname || row.name || row.owner || row.ownername,
        email: row.email || undefined,
        balance: row.balance || row.amountdue || row.totaldue || row.currentbalance || "0",
        balanceReference: row.balancereference || row.statement || row.report || "",
        asOf: row.asof || row.date || undefined
      });
      parseBalance(record.balance);
      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid row";
      throw new Error(`Row ${index + 2}: ${message}`);
    }
  });
}

function importKey(record: VantacaImportRecord, balance: number, asOf: string) {
  const identity = record.externalBillingId || normalizeUnitAddress(record.unitAddress) || record.email || record.residentName;
  return ["vantaca", identity, balance.toFixed(2), record.balanceReference, asOf].join(":");
}

function matchResident(record: VantacaImportRecord, residents: ResidentMatchRow[]) {
  if (record.externalBillingId) {
    const externalMatch = residents.find((resident) => resident.external_billing_id === record.externalBillingId);
    if (externalMatch) return externalMatch.id;
  }
  if (record.unitAddress) {
    const normalized = normalizeUnitAddress(record.unitAddress);
    const addressMatch = residents.find((resident) => normalizeUnitAddress(resident.unit_address) === normalized);
    if (addressMatch) return addressMatch.id;
  }
  if (record.email) {
    const emailMatch = residents.find((resident) => resident.email.toLowerCase() === record.email?.toLowerCase());
    if (emailMatch) return emailMatch.id;
  }
  return null;
}

export async function stageVantacaImport(supabase: SupabaseClient, records: VantacaImportRecord[], source = "manual-import") {
  if (records.length === 0) return { imported: 0, matched: 0, pending: 0 };

  const residentsResult = await supabase
    .from("residents")
    .select("id,unit_address,external_billing_id,email");
  if (residentsResult.error) throw residentsResult.error;

  const residents = (residentsResult.data ?? []) as ResidentMatchRow[];
  const asOfDefault = new Date().toISOString();
  const rows = records.map((record) => {
    const balance = parseBalance(record.balance);
    const asOf = record.asOf ?? asOfDefault;
    return {
      import_key: importKey(record, balance, asOf),
      external_billing_id: record.externalBillingId || null,
      unit_address: record.unitAddress || null,
      resident_name: record.residentName || null,
      email: record.email ?? null,
      balance,
      dues_status: duesStatusForBalance(balance),
      balance_reference: record.balanceReference || "",
      source,
      matched_resident_id: matchResident(record, residents),
      status: "pending"
    };
  });

  const { data, error } = await supabase
    .from("vantaca_balance_reviews")
    .upsert(rows, { onConflict: "import_key" })
    .select("id,status,matched_resident_id");
  if (error) throw error;

  return {
    imported: data.length,
    matched: data.filter((row) => row.matched_resident_id).length,
    pending: data.filter((row) => row.status === "pending").length
  };
}
