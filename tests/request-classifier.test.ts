import { describe, expect, it } from "vitest";
import { RuleBasedRequestClassifier } from "@/domain/request-classifier";

describe("rule based request classifier", () => {
  it("surfaces urgent facility emails", () => {
    const result = new RuleBasedRequestClassifier().classify({ fromEmail: "owner@example.com", subject: "Emergency broken pool gate", bodyText: "locked out", receivedAt: new Date().toISOString() });
    expect(result.priority).toBe("urgent");
    expect(result.category).toBe("facilities");
    expect(result.actionNeeded).toBe("emergency_response");
  });

  it("routes invoices to invoice review", () => {
    const result = new RuleBasedRequestClassifier().classify({ fromEmail: "vendor@example.com", subject: "Landscaping invoice", bodyText: "Payment due this week", receivedAt: new Date().toISOString() });
    expect(result.priority).toBe("normal");
    expect(result.category).toBe("invoice");
    expect(result.actionNeeded).toBe("invoice_review");
  });
});
