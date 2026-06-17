import { describe, expect, it } from "vitest";
import { getCategorizationRulesResult, isMissingRulesTableError } from "@/services/categorization-rules-service";

function supabaseWithRulesError(error: { code: string; message: string }) {
  return {
    from: () => ({
      select: () => ({
        order: () => ({
          order: async () => ({ data: null, error })
        })
      })
    })
  };
}

describe("categorization rules service", () => {
  it("treats Supabase schema-cache misses as an unmigrated rules table", () => {
    expect(isMissingRulesTableError({ code: "PGRST205", message: "Could not find the table 'public.request_categorization_rules' in the schema cache" })).toBe(true);
  });

  it("falls back to read-only defaults when the rules table has not been migrated", async () => {
    const result = await getCategorizationRulesResult(supabaseWithRulesError({ code: "PGRST205", message: "Could not find the table 'public.request_categorization_rules' in the schema cache" }) as never);

    expect(result.tableReady).toBe(false);
    expect(result.warning).toContain("0009_request_categorization_rules.sql");
    expect(result.rules.length).toBeGreaterThan(0);
  });
});
