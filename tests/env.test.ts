import { afterEach, describe, expect, it } from "vitest";
import { requiredEnvFrom } from "@/lib/env";

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("requiredEnvFrom", () => {
  it("returns the first configured environment variable", () => {
    process.env = { ...ORIGINAL_ENV, PRIMARY_KEY: "primary", FALLBACK_KEY: "fallback" };

    expect(requiredEnvFrom(["PRIMARY_KEY", "FALLBACK_KEY"])).toBe("primary");
  });

  it("falls back to later environment variable names", () => {
    process.env = { ...ORIGINAL_ENV, PRIMARY_KEY: "", FALLBACK_KEY: "fallback" };

    expect(requiredEnvFrom(["PRIMARY_KEY", "FALLBACK_KEY"])).toBe("fallback");
  });

  it("reports every accepted environment variable name when none are configured", () => {
    process.env = { ...ORIGINAL_ENV, PRIMARY_KEY: "", FALLBACK_KEY: "" };

    expect(() => requiredEnvFrom(["PRIMARY_KEY", "FALLBACK_KEY"])).toThrow("Missing required env var PRIMARY_KEY or FALLBACK_KEY");
  });
});
