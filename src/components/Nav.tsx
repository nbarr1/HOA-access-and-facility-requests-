import Link from "next/link";

export function Nav() {
  return <nav className="nav"><strong>HOA Facility Access</strong><span><Link href="/dashboard">Dashboard</Link><Link href="/triage">Triage</Link><Link href="/acc">ACC</Link><Link href="/vantaca">Vantaca</Link><Link href="/audit">Audit</Link></span></nav>;
}
