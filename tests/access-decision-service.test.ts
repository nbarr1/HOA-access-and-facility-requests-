import { describe, expect, it } from "vitest";
import { MockAccessProvider } from "@/adapters/mock-access-provider";
import { AccessDecisionService } from "@/services/access-decision-service";
import { InMemoryAuditSink } from "@/services/audit-service";
import type { Resident } from "@/domain/types";

const resident: Resident = { id: "resident-id", name: "Resident", unitAddress: "Unit Address", email: "resident@example.invalid", duesStatus: "paid", accessStatus: "granted", lastSyncedAt: "2026-05-30" };

describe("access decision service", () => {
  it("audits before provider action and logs provider result", async () => {
    const provider = new MockAccessProvider();
    const audit = new InMemoryAuditSink();
    const service = new AccessDecisionService(provider, audit);

    await service.reconcileDuesStatus(resident, "lapsed");

    expect(audit.entries[0]?.action).toBe("decision.revoke");
    expect(provider.calls).toHaveLength(1);
    expect(audit.entries[1]?.action).toBe("provider.completed");
  });
});
