import { getNavigationAccess } from "@/lib/navigation-auth";
import { setSupabaseAuthCookies } from "@/lib/auth-cookies";
import { createSupabasePublicClient } from "@/lib/supabase";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};

async function signInWithPassword(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) redirect("/login?error=Email%20and%20password%20are%20required.");

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) redirect(`/login?error=${encodeURIComponent(error?.message ?? "Unable to sign in.")}`);

  await setSupabaseAuthCookies({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type
  });

  redirect("/");
}

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();

  if (!email) redirect("/login?error=Email%20is%20required.");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? requiredOrigin();
  const supabase = createSupabasePublicClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` }
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?message=Check%20your%20email%20for%20a%20sign-in%20link.");
}

function requiredOrigin() {
  return process.env.HOA_APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const access = await getNavigationAccess();
  if (access.isBoardUser) redirect("/dashboard");
  if (access.isAccCommitteeMember) redirect("/acc-audit");

  const params = await searchParams;
  const error = params?.error;
  const message = params?.message;

  return <main className="auth-shell"><section className="card auth-card"><h1>Sign in</h1><p>Use your authorized HOA board or ACC committee Supabase account to access protected dashboards.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}{message ? <div className="auth-message" role="status">{message}</div> : null}<form action={sendMagicLink} className="auth-form"><label htmlFor="magic-email">Email</label><input id="magic-email" name="email" type="email" autoComplete="email" required /><button type="submit">Email me a sign-in link</button></form><details className="password-details"><summary>Sign in with password instead</summary><form action={signInWithPassword} className="auth-form"><label htmlFor="password-email">Email</label><input id="password-email" name="email" type="email" autoComplete="email" required /><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /><button type="submit">Sign in with password</button></form></details></section></main>;
}
