import Link from "next/link";
import type { NavigationAccess } from "@/lib/navigation-auth";

export function Nav() {
  return <nav className="nav"><strong>HOA Facility Access</strong><span><Link href="/dashboard">Dashboard</Link><Link href="/triage">Triage</Link><Link href="/vantaca">Vantaca</Link><Link href="/audit">Audit</Link><Link href="/acc-audit">ACC Audit</Link></span></nav>;
}
