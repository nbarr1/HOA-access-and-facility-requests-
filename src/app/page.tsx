import { redirect } from "next/navigation";
import { getNavigationAccess } from "@/lib/navigation-auth";

export default async function Home() {
  const access = await getNavigationAccess();

  if (access.isBoardUser) redirect("/dashboard");
  if (access.isAccCommitteeMember) redirect("/acc-audit");

  return <main><h1>HOA Facility Access</h1><p>Please sign in with an authorized board or ACC committee account to view protected dashboards.</p></main>;
}
