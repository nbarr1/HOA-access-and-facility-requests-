import type { AccessProvider, AccessActionResult } from "./access-provider";
import type { Facility, Resident } from "@/domain/types";

export class AirAllowApiAdapter implements AccessProvider {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async grantAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    return this.call("grant", resident, facilities, idempotencyKey);
  }

  async revokeAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    return this.call("revoke", resident, facilities, idempotencyKey);
  }

  private async call(action: "grant" | "revoke", resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult> {
    if (!this.baseUrl || !this.token) throw new Error("AirAllow API adapter requires vendor-approved base URL and token.");
    const response = await fetch(`${this.baseUrl}/access/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}`, "idempotency-key": idempotencyKey },
      body: JSON.stringify({ residentExternalId: resident.externalAccessId, residentEmail: resident.email, facilities })
    });
    if (!response.ok) throw new Error(`AirAllow API ${action} failed with ${response.status}`);
    return { provider: "airallow-api", mode: "api", status: "completed", externalReference: idempotencyKey };
  }
}
