import type { AccessProvider, AccessActionResult } from "./access-provider";
import type { Facility, Resident } from "@/domain/types";

export class MockAccessProvider implements AccessProvider {
  public calls: string[] = [];
  async grantAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    this.calls.push(`grant:${resident.id}:${facilities.join(",")}:${idempotencyKey}`);
    return { provider: "mock", mode: "mock", status: "completed", externalReference: idempotencyKey };
  }
  async revokeAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    this.calls.push(`revoke:${resident.id}:${facilities.join(",")}:${idempotencyKey}`);
    return { provider: "mock", mode: "mock", status: "completed", externalReference: idempotencyKey };
  }
}
