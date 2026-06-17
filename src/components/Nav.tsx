import React from "react";
import Link from "next/link";
import type { NavigationAccess } from "@/lib/navigation-auth";

type NavProps = {
  access?: NavigationAccess;
};

export function Nav({ access }: NavProps) {
  const showBoardLinks = access?.isBoardUser ?? false;
  const showAccLinks = access?.isAccCommitteeMember ?? false;

  return (
    <nav className="nav">
      <strong>HOA Facility Access</strong>
      <span>
        {showBoardLinks ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/triage">Triage</Link>
            <Link href="/vantaca">Vantaca</Link>
            <Link href="/audit">Audit</Link>
          </>
        ) : null}
        {showAccLinks ? <Link href="/acc-audit">ACC Audit</Link> : null}
        {showBoardLinks || showAccLinks ? <form action="/logout" method="POST" className="nav-form"><button type="submit">Sign out</button></form> : <Link href="/login">Sign in</Link>}
      </span>
    </nav>
  );
}
