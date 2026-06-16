import { cookies } from "next/headers";
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

function decodeSupabaseAuthCookie(value: string): string | null {
  try {
    const payload = value.startsWith("base64-") ? Buffer.from(value.slice("base64-".length), "base64url").toString("utf8") : value;
    const parsed = JSON.parse(payload) as { access_token?: string } | [string] | string[];
    if (Array.isArray(parsed)) return typeof parsed[0] === "string" ? parsed[0] : null;
    return typeof parsed.access_token === "string" ? parsed.access_token : null;
  } catch {
    return null;
  }
}

async function getSupabaseAccessToken() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.getAll().find((cookie) => cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token"));
  return authCookie ? decodeSupabaseAuthCookie(authCookie.value) : null;
}

async function getCurrentUserId() {
  const accessToken = await getSupabaseAccessToken();
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
