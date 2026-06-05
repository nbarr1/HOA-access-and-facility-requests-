import type { Resident, RequestRecord } from "@/domain/types";

export const demoResidents: Resident[] = [
  { id: "res-1", name: "Jane Doe", unitAddress: "101 Oak Lane", email: "jane@example.com", duesStatus: "paid", accessStatus: "granted", externalAccessId: "aa-101", externalBillingId: "va-101", lastSyncedAt: "2026-05-30T12:00:00Z" },
  { id: "res-2", name: "Sam Rivera", unitAddress: "204 Pine Court", email: "sam@example.com", duesStatus: "lapsed", accessStatus: "pending", externalAccessId: "aa-204", externalBillingId: "va-204", lastSyncedAt: "2026-05-30T12:00:00Z" },
  { id: "res-3", name: "Priya Shah", unitAddress: "18 Clubhouse Dr", email: "priya@example.com", duesStatus: "unknown", accessStatus: "hold", externalAccessId: "aa-018", externalBillingId: "va-018", lastSyncedAt: null, overrideReason: "Board review pending." }
];

export const demoRequests: RequestRecord[] = [
  { id: "req-1", category: "facilities", priority: "urgent", status: "new", subject: "Pool gate will not latch", from_email: "lifeguard@example.com" },
  { id: "req-2", category: "access", priority: "high", status: "new", subject: "Need tennis access after paying dues", from_email: "jane@example.com" },
  { id: "req-3", category: "invoice", priority: "normal", status: "in_progress", subject: "Landscaping invoice", from_email: "vendor@example.com" }
];
