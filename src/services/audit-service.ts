import type { AuditEntry } from "@/domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAppendResult = { id: string | null; inserted: boolean };

export interface AuditSink { append(entry: AuditEntry): Promise<AuditAppendResult>; }

export class InMemoryAuditSink implements AuditSink {
  public entries: AuditEntry[] = [];
  async append(entry: AuditEntry): Promise<AuditAppendResult> {
    this.entries.push(entry);
    return { id: null, inserted: true };
  }
}

export class SupabaseAuditSink implements AuditSink {
  constructor(private readonly supabase: SupabaseClient) {}

  async append(entry: AuditEntry): Promise<AuditAppendResult> {
    const actorName = entry.actor.type === "user" ? entry.actor.name : "system";
    const actorId = entry.actor.type === "user" ? entry.actor.id : null;
    const payload = {
      actor_id: actorId,
      actor_name: actorName,
      actor_type: entry.actor.type,
      action: entry.action,
      target_resident_id: entry.targetResidentId ?? null,
      reason: entry.reason,
      before_state: entry.before,
      after_state: entry.after,
      idempotency_key: entry.idempotencyKey
    };

    const { data, error } = await this.supabase
      .from("audit_log")
      .upsert(payload, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return { id: data.id, inserted: true };

    const existing = await this.supabase.from("audit_log").select("id").eq("idempotency_key", entry.idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    return { id: existing.data?.id ?? null, inserted: false };
  }
}
