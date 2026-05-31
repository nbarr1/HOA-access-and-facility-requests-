import type { Facility, Resident } from "@/domain/types";

export type AccessActionResult = {
  provider: string;
  mode: "api" | "manual" | "mock";
  status: "completed" | "manual_task_created" | "noop";
  externalReference?: string;
  instructions?: string;
};

export interface AccessProvider {
  grantAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult>;
  revokeAccess(resident: Resident, facilities: Facility[], idempotencyKey: string): Promise<AccessActionResult>;
}
