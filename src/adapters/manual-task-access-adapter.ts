import type { AccessProvider, AccessActionResult } from "./access-provider";
import type { Facility, Resident } from "@/domain/types";

export class ManualTaskAccessAdapter implements AccessProvider {
  async grantAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    return this.card("Grant", resident, facilities, idempotencyKey);
  }

  async revokeAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    return this.card("Revoke", resident, facilities, idempotencyKey);
  }

  private card(verb: "Grant" | "Revoke", resident: Resident, facilities: Facility[], idempotencyKey: string): AccessActionResult {
    const list = facilities.join("/");
    return {
      provider: "airallow-manual",
      mode: "manual",
      status: "manual_task_created",
      externalReference: idempotencyKey,
      instructions: `${verb} ${list} access for ${resident.name} (${resident.unitAddress}) in AirAllow/Allow Enclave, then mark this task done.`
    };
  }
}
