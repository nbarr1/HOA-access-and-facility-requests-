import { describe, expect, it } from "vitest";
import { isAccFormEmail, RuleBasedRequestClassifier } from "@/domain/request-classifier";

describe("rule based request classifier", () => {
  it("surfaces urgent facility emails", () => {
    const result = new RuleBasedRequestClassifier().classify({ fromEmail: "sender@example.invalid", subject: "Emergency broken pool gate", bodyText: "locked out", receivedAt: new Date().toISOString() });
    expect(result.priority).toBe("urgent");
    expect(result.category).toBe("facilities");
    expect(result.actionNeeded).toBe("emergency_response");
  });

  it("routes invoices to invoice review", () => {
    const result = new RuleBasedRequestClassifier().classify({ fromEmail: "sender@example.invalid", subject: "Service invoice", bodyText: "Payment due this week", receivedAt: new Date().toISOString() });
    expect(result.priority).toBe("normal");
    expect(result.category).toBe("invoice");
    expect(result.actionNeeded).toBe("invoice_review");
  });

  it("detects ACC form emails with deterministic architectural markers", () => {
    expect(isAccFormEmail({ fromEmail: "form@example.invalid", subject: "Architectural request", bodyText: "Exterior modification submitted for design review." })).toBe(true);
  });

  it("detects ACC form emails from the dedicated ACC sender", () => {
    expect(isAccFormEmail({ fromEmail: "accplantersrow@gmail.com", subject: "New request", bodyText: "Please review this submission." })).toBe(true);
    expect(isAccFormEmail({ fromEmail: " ACCPlantersRow@gmail.com ", subject: "New request", bodyText: "Please review this submission." })).toBe(true);
  });

  it("does not classify generic triage emails as ACC requests", () => {
    expect(isAccFormEmail({ fromEmail: "sender@example.invalid", subject: "Pool light repair", bodyText: "The clubhouse entry light is broken." })).toBe(false);
  });
});
