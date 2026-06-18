import type { DuesStatus } from "@/domain/types";

export type BillingStatusRecord = {
  externalBillingId?: string;
  residentId?: string;
  unitAddress?: string;
  duesStatus: DuesStatus;
  balanceReference: string;
  asOf: string;
};
export interface BillingProvider { fetchDuesStatuses(since?: string): Promise<BillingStatusRecord[]>; }
