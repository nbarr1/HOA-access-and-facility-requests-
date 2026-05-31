import type { BillingProvider, BillingStatusRecord } from "./billing-provider";

export class ManualTaskBillingAdapter implements BillingProvider {
  async fetchDuesStatuses(): Promise<BillingStatusRecord[]> {
    return [];
  }
}
