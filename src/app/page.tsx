import { redirect } from "next/navigation";
import { getNavigationAccess } from "@/lib/navigation-auth";

export default async function Home() {
  const access = await getNavigationAccess();

  if (access.isBoardUser) redirect("/dashboard");
  if (access.isAccCommitteeMember) redirect("/acc-audit");

  redirect("/login");
}
