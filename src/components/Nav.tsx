import Link from "next/link";
import type { NavigationAccess } from "@/lib/navigation-auth";

type NavProps = {
  access?: NavigationAccess;
};

export function Nav({ access }: NavProps) {
  const showBoardLinks = access?.isBoardUser ?? true;
  const showAccLinks = access?.isAccCommitteeMember ?? true;

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
      </span>
    </nav>
  );
}
