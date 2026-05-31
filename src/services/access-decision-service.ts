import type { AccessProvider } from "@/adapters/access-provider";
import { decideAccessForDues } from "@/domain/access-state-machine";
import type { Actor, DuesStatus, Facility, Resident } from "@/domain/types";
import type { AuditSink } from "./audit-service";

export class AccessDecisionService {
  constructor(private readonly accessProvider: AccessProvider, private readonly auditSink: AuditSink) {}

  async reconcileDuesStatus(resident: Resident, nextDuesStatus: DuesStatus, actor: Actor = { type: "system", id: "system" }) {
    const decision = decideAccessForDues(resident, nextDuesStatus);
    const idempotencyKey = `dues:${resident.id}:${nextDuesStatus}:${resident.lastSyncedAt ?? "initial"}`;
    const after = { ...resident, duesStatus: nextDuesStatus, accessStatus: decision.desiredStatus };

    await this.auditSink.append({ actor, action: `decision.${decision.action}`, targetResidentId: resident.id, reason: decision.reason, before: resident, after, idempotencyKey });

    if (decision.action === "none") return { decision, providerResult: undefined };

    const facilities: Facility[] = ["pool", "tennis", "clubhouse"];
    const providerResult = decision.action === "grant"
      ? await this.accessProvider.grantAccess(resident, facilities, idempotencyKey)
      : await this.accessProvider.revokeAccess(resident, facilities, idempotencyKey);

    await this.auditSink.append({ actor, action: `provider.${providerResult.status}`, targetResidentId: resident.id, reason: providerResult.instructions ?? decision.reason, before: resident, after: { ...after, providerResult }, idempotencyKey: `${idempotencyKey}:provider` });

    return { decision, providerResult };
  }
}
