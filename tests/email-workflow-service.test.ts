import { describe, expect, it } from "vitest";
import { inferSentEmailAction, normalizeThreadSubject, referencedMessageIds } from "@/services/email-workflow-service";

describe("sent email workflow helpers", () => {
  it("normalizes reply and forward prefixes for thread matching", () => {
    expect(normalizeThreadSubject(" Re: Fwd: Pool Gate Repair ")).toBe("pool gate repair");
  });

  it("deduplicates referenced message ids", () => {
    expect(referencedMessageIds({ inReplyTo: " <abc@example> ", references: ["<abc@example>", "<def@example>"] })).toEqual(["<abc@example>", "<def@example>"]);
  });

  it("marks completion language as done", () => {
    expect(inferSentEmailAction("This has been approved and sent to the vendor.")).toEqual({ actionTaken: "completion_indicated", status: "done" });
  });

  it("does not mark questions as done", () => {
    expect(inferSentEmailAction("Is this resolved?")).toEqual({ actionTaken: "reply_sent", status: "in_progress" });
  });

  it("does not mark negated statements as done", () => {
    expect(inferSentEmailAction("This is not approved yet.")).toEqual({ actionTaken: "reply_sent", status: "in_progress" });
  });

  it("marks a regular outbound reply as in progress", () => {
    expect(inferSentEmailAction("Thanks, I will check and follow up shortly.")).toEqual({ actionTaken: "reply_sent", status: "in_progress" });
  });
});
