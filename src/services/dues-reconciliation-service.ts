import { AirAllowApiAdapter } from "@/adapters/airallow-api-adapter";
import type { AccessActionResult } from "@/adapters/access-provider";
import type { BillingStatusRecord } from "@/adapters/billing-provider";
import { ManualTaskAccessAdapter } from "@/adapters/manual-task-access-adapter";
import type { AccessStatus, DuesStatus, Resident } from "@/domain/types";
import { normalizeUnitAddress } from "@/lib/address-normalization";
import { AccessDecisionService } from "@/services/access-decision-service";
import { SupabaseAuditSink } from "@/services/audit-service";
import type { SupabaseClient } from "@supabase/supabase-js";

type ResidentRow = {
  id: string;
  name: string;
  unit_address: string;
  email: string;
  dues_status: DuesStatus;
  access_status: AccessStatus;
  external_access_id: string | null;
  external_billing_id: string | null;
  last_synced_at: string | null;
  override_reason: string | null;
};

export type DuesReconciliationResult = {
  externalBillingId?: string;
  residentId?: string;
  status: "matched" | "unmatched" | "unchanged" | "manual_task_created" | "provider_completed" | "error";
  error?: string;
};

function toResident(row: ResidentRow): Resident {
  return {
    id: row.id,
    name: row.name,
    unitAddress: row.unit_address,
    email: row.email,
    duesStatus: row.dues_status,
    accessStatus: row.access_status,
    externalAccessId: row.external_access_id,
    externalBillingId: row.external_billing_id,
    lastSyncedAt: row.last_synced_at,
    overrideReason: row.override_reason
  };
}

function createAccessProvider() {
  return process.env.AIRALLOW_ADAPTER === "api"
    ? new AirAllowApiAdapter(process.env.AIRALLOW_API_BASE_URL ?? "", process.env.AIRALLOW_API_TOKEN ?? "")
    : new ManualTaskAccessAdapter();
}

function nextAccessStatus(current: AccessStatus, desired: AccessStatus, providerResult?: AccessActionResult): AccessStatus {
  if (!providerResult) return current;
  if (providerResult.status === "completed") return desired;
  if (providerResult.status === "manual_task_created") return "pending";
  return current;
}

function syncScope(record: BillingStatusRecord) {
  return record.asOf || record.balanceReference || "unknown";
}

async function findResident(supabase: SupabaseClient, record: BillingStatusRecord) {
  if (record.residentId) {
    const result = await supabase
      .from("residents")
      .select("id,name,unit_address,email,dues_status,access_status,external_access_id,external_billing_id,last_synced_at,override_reason")
      .eq("id", record.residentId)
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) return result.data as ResidentRow;
  }
  if (!record.externalBillingId && !record.unitAddress) return null;
  if (record.externalBillingId) {
    const result = await supabase
      .from("residents")
      .select("id,name,unit_address,email,dues_status,access_status,external_access_id,external_billing_id,last_synced_at,override_reason")
      .eq("external_billing_id", record.externalBillingId)
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data) return result.data as ResidentRow;
  }
  if (!record.unitAddress) return null;

  const exactResult = await supabase
    .from("residents")
    .select("id,name,unit_address,email,dues_status,access_status,external_access_id,external_billing_id,last_synced_at,override_reason")
    .eq("unit_address", record.unitAddress)
    .limit(1)
    .maybeSingle();
  if (exactResult.error) throw exactResult.error;
  if (exactResult.data) return exactResult.data as ResidentRow;

  const result = await supabase
    .from("residents")
    .select("id,name,unit_address,email,dues_status,access_status,external_access_id,external_billing_id,last_synced_at,override_reason")
    .limit(1000);
  if (result.error) throw result.error;
  const normalized = normalizeUnitAddress(record.unitAddress);
  return ((result.data ?? []) as ResidentRow[]).find((resident) => normalizeUnitAddress(resident.unit_address) === normalized) ?? null;
}

export async function reconcileBillingStatus(supabase: SupabaseClient, statusRecord: BillingStatusRecord): Promise<DuesReconciliationResult> {
  try {
    const residentRow = await findResident(supabase, statusRecord);
    if (!residentRow) return { externalBillingId: statusRecord.externalBillingId, status: "unmatched" };

    const resident = toResident(residentRow);
    const decisionService = new AccessDecisionService(createAccessProvider(), new SupabaseAuditSink(supabase));
    const reconciliation = await decisionService.reconcileDuesStatus(resident, statusRecord.duesStatus, { type: "system", id: "system" }, syncScope(statusRecord));
    const accessStatus = nextAccessStatus(resident.accessStatus, reconciliation.decision.desiredStatus, reconciliation.providerResult);
    const updateResult = await supabase
      .from("residents")
      .update({ dues_status: statusRecord.duesStatus, access_status: accessStatus, last_synced_at: statusRecord.asOf })
      .eq("id", resident.id);
    if (updateResult.error) throw updateResult.error;

    if (reconciliation.providerResult?.status === "manual_task_created") {
      const existingTask = reconciliation.providerAuditId
        ? await supabase.from("manual_tasks").select("id").eq("created_by_audit_id", reconciliation.providerAuditId).maybeSingle()
        : await supabase.from("manual_tasks").select("id").eq("resident_id", resident.id).eq("action", reconciliation.decision.action).eq("status", "pending").maybeSingle();
      if (existingTask.error) throw existingTask.error;

      if (!existingTask.data) {
        const taskResult = await supabase.from("manual_tasks").insert({
          provider: reconciliation.providerResult.provider,
          resident_id: resident.id,
          action: reconciliation.decision.action,
          instructions: reconciliation.providerResult.instructions ?? reconciliation.decision.reason,
          created_by_audit_id: reconciliation.providerAuditId
        });
        if (taskResult.error) throw taskResult.error;
      }
    }

    return {
      externalBillingId: statusRecord.externalBillingId,
      residentId: resident.id,
      status: reconciliation.providerResult?.status === "manual_task_created"
        ? "manual_task_created"
        : reconciliation.providerResult?.status === "completed"
          ? "provider_completed"
          : reconciliation.decision.action === "none"
            ? "unchanged"
            : "matched"
    };
  } catch (error) {
    return { externalBillingId: statusRecord.externalBillingId, status: "error", error: error instanceof Error ? error.message : "Unknown sync error" };
  }
}
