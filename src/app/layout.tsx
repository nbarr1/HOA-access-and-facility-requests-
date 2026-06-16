import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/Nav";
import { getNavigationAccess } from "@/lib/navigation-auth";
import "./globals.css";

export const metadata: Metadata = { title: "HOA Access Control", description: "Transparent facility access and request triage for HOA boards" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getNavigationAccess();

  return <html lang="en"><body><Nav access={access} />{children}<Analytics /></body></html>;
}
