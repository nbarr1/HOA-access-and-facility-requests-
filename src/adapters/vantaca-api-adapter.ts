import type { BillingProvider, BillingStatusRecord } from "./billing-provider";
import { z } from "zod";

const billingStatusSchema = z.array(z.object({
  externalBillingId: z.string(),
  duesStatus: z.enum(["paid", "lapsed", "unknown"]),
  balanceReference: z.string(),
  asOf: z.string()
}));

export class VantacaApiBillingAdapter implements BillingProvider {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  async fetchDuesStatuses(since?: string): Promise<BillingStatusRecord[]> {
    if (!this.baseUrl || !this.token) throw new Error("Vantaca API adapter requires vendor-approved base URL and token.");
    const baseUrlNormalized = this.baseUrl.endsWith("/") ? this.baseUrl : this.baseUrl + "/";
    const url = new URL("dues-statuses", baseUrlNormalized);
    if (since) url.searchParams.set("since", since);
    const response = await fetch(url, { headers: { authorization: `Bearer ${this.token}` } });
    if (!response.ok) throw new Error(`Vantaca dues sync failed with ${response.status}`);
    return billingStatusSchema.parse(await response.json());
  }
}
