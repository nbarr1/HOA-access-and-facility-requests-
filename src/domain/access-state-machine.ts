import type { AccessStatus, DuesStatus, Resident } from "./types";

export type AccessDecision = {
  desiredStatus: AccessStatus;
  action: "grant" | "revoke" | "none";
  reason: string;
};

export function decideAccessForDues(resident: Resident, nextDuesStatus: DuesStatus): AccessDecision {
  if (resident.accessStatus === "hold") {
    return { desiredStatus: "hold", action: "none", reason: "Resident is on board hold; automation paused." };
  }

  if (nextDuesStatus === "paid") {
    return resident.accessStatus === "granted"
      ? { desiredStatus: "granted", action: "none", reason: "Dues are paid and access is already granted." }
      : { desiredStatus: "granted", action: "grant", reason: "Dues confirmed paid." };
  }

  if (nextDuesStatus === "lapsed") {
    return resident.accessStatus === "revoked"
      ? { desiredStatus: "revoked", action: "none", reason: "Dues are lapsed and access is already revoked." }
      : { desiredStatus: "revoked", action: "revoke", reason: "Dues lapsed." };
  }

  return { desiredStatus: resident.accessStatus, action: "none", reason: "Dues status unknown; no automated access change." };
}

export function applyBoardOverride(status: AccessStatus, reason: string): AccessDecision {
  if (!reason.trim()) throw new Error("A board override requires a reason.");
  if (status === "granted") return { desiredStatus: "granted", action: "grant", reason };
  if (status === "revoked") return { desiredStatus: "revoked", action: "revoke", reason };
  if (status === "hold") return { desiredStatus: "hold", action: "none", reason };
  return { desiredStatus: "pending", action: "none", reason };
}
