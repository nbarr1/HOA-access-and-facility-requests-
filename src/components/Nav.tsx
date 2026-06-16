import Link from "next/link";
import type { NavigationAccess } from "@/lib/navigation-auth";

const boardLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/triage", label: "Triage" },
  { href: "/vantaca", label: "Vantaca" },
  { href: "/audit", label: "Audit" }
];

export function Nav({ access }: { access: NavigationAccess }) {
  const canViewAccAudit = access.isBoardUser || access.isAccCommitteeMember;
  const links = access.isBoardUser ? boardLinks : [];

  return (
    <nav className="nav">
      <strong>HOA Facility Access</strong>
      <span>
        {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
        {canViewAccAudit ? <Link href="/acc-audit">ACC Audit</Link> : null}
      </span>
    </nav>
  );
}
