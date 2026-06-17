import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Nav } from "@/components/Nav";

describe("Nav", () => {
  it("does not expose protected board or ACC links without access", () => {
    const html = renderToStaticMarkup(<Nav />);

    expect(html).toContain("/login");
    expect(html).not.toContain("/dashboard");
    expect(html).not.toContain("/triage");
    expect(html).not.toContain("/vantaca");
    expect(html).not.toContain("/audit");
    expect(html).not.toContain("/settings/categories");
    expect(html).not.toContain("/acc-audit");
  });

  it("shows only permitted protected links for mixed roles", () => {
    const accOnly = renderToStaticMarkup(<Nav access={{ isBoardUser: false, isAccCommitteeMember: true }} />);
    const boardOnly = renderToStaticMarkup(<Nav access={{ isBoardUser: true, isAccCommitteeMember: false }} />);

    expect(accOnly).toContain("/acc-audit");
    expect(accOnly).not.toContain("/dashboard");
    expect(boardOnly).toContain("/dashboard");
    expect(boardOnly).toContain("/settings/categories");
    expect(boardOnly).not.toContain("/acc-audit");
  });
});
