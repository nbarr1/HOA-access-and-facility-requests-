import { describe, expect, it } from "vitest";
import { normalizeUnitAddress } from "@/lib/address-normalization";
import { parseBalance, parseVantacaCsv } from "@/services/vantaca-import-service";

describe("Vantaca import service", () => {
  it("parses address-first balance exports without names or emails", () => {
    const records = parseVantacaCsv("Home Address,Current Balance\n123 Main Street,$42.50\n");

    expect(records).toEqual([{
      externalBillingId: "",
      unitAddress: "123 Main Street",
      residentName: "",
      balance: "$42.50",
      balanceReference: ""
    }]);
  });

  it("normalizes common address variants for resident matching", () => {
    expect(normalizeUnitAddress("123 Main Street Apt 4")).toBe(normalizeUnitAddress("123 Main St #4"));
  });

  it("parses currency balances", () => {
    expect(parseBalance("$1,234.56")).toBe(1234.56);
  });
});
