import { describe, expect, it } from "vitest";
import { decideAccessForDues, applyBoardOverride } from "@/domain/access-state-machine";
import type { Resident } from "@/domain/types";

const baseResident: Resident = { id: "1", name: "Jane Doe", unitAddress: "101 Oak", email: "jane@example.com", duesStatus: "unknown", accessStatus: "pending" };

describe("access state machine", () => {
  it("grants access when dues are confirmed paid", () => {
    expect(decideAccessForDues(baseResident, "paid")).toMatchObject({ desiredStatus: "granted", action: "grant" });
  });

  it("revokes access when dues lapse", () => {
    expect(decideAccessForDues({ ...baseResident, accessStatus: "granted" }, "lapsed")).toMatchObject({ desiredStatus: "revoked", action: "revoke" });
  });

  it("does not automate residents on hold", () => {
    expect(decideAccessForDues({ ...baseResident, accessStatus: "hold" }, "paid")).toMatchObject({ desiredStatus: "hold", action: "none" });
  });

  it("requires board override reasons", () => {
    expect(() => applyBoardOverride("granted", "")).toThrow("requires a reason");
  });
});
