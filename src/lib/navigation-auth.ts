import { getSupabaseAccessTokenFromCookies } from "./auth-cookies";
import { redirect } from "next/navigation";
import { createSupabasePublicClient, createSupabaseServiceClient } from "./supabase";

type AppRole = "board_admin" | "board_member" | "resident";

type ProfileRow = {
  id: string;
  role: AppRole;
};

export type NavigationAccess = {
  isBoardUser: boolean;
  isAccCommitteeMember: boolean;
};


export async function getCurrentUserId() {
  const accessToken = await getSupabaseAccessTokenFromCookies();
  if (!accessToken) return null;

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return null;
  return data.user?.id ?? null;
}

async function getActiveAccMembership(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("acc_committee_members")
    .select("id")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

export async function getNavigationAccess(): Promise<NavigationAccess> {
  const userId = await getCurrentUserId();
  if (!userId) return { isBoardUser: false, isAccCommitteeMember: false };

  const supabase = createSupabaseServiceClient();
  const { data: profile } = await supabase.from("profiles").select("id,role").eq("id", userId).maybeSingle<ProfileRow>();
  const isBoardUser = profile?.role === "board_admin" || profile?.role === "board_member";
  const isAccCommitteeMember = await getActiveAccMembership(userId);

  return { isBoardUser, isAccCommitteeMember };
}


export async function requireBoardUser() {
  const access = await getNavigationAccess();
  if (!access.isBoardUser) redirect("/login?error=Please%20sign%20in%20with%20a%20board%20account.");
  return access;
}

export async function requireAccAccess() {
  const access = await getNavigationAccess();
  if (!access.isBoardUser && !access.isAccCommitteeMember) redirect("/login?error=Please%20sign%20in%20with%20an%20ACC%20or%20board%20account.");
  return access;
}
