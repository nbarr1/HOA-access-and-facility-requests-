import { setSupabaseAuthCookies } from "@/lib/auth-cookies";
import { createSupabasePublicClient } from "@/lib/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function redirectToLogin(request: Request, message: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const supabase = createSupabasePublicClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { data: { session: null }, error: new Error("Missing authentication token.") };

  if (result.error || !result.data.session) return redirectToLogin(request, result.error?.message ?? "Unable to complete sign in.");

  await setSupabaseAuthCookies({
    access_token: result.data.session.access_token,
    refresh_token: result.data.session.refresh_token,
    expires_at: result.data.session.expires_at,
    expires_in: result.data.session.expires_in,
    token_type: result.data.session.token_type
  });

  return NextResponse.redirect(new URL(nextPath, request.url));
}
