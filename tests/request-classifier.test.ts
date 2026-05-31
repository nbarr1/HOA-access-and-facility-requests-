import { describe, expect, it } from "vitest";
import { RuleBasedRequestClassifier } from "@/domain/request-classifier";

describe("rule based request classifier", () => {
  it("surfaces urgent facility emails", () => {
    const result = new RuleBasedRequestClassifier().classify({ fromEmail: "owner@example.com", subject: "Emergency broken pool gate", bodyText: "locked out", receivedAt: new Date().toISOString() });
    expect(result.priority).toBe("urgent");
    expect(result.category).toBe("facilities");
  });
});
