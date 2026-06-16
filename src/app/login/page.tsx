import { getNavigationAccess } from "@/lib/navigation-auth";
import { setSupabaseAuthCookies } from "@/lib/auth-cookies";
import { createSupabasePublicClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

async function signIn(formData: FormData) {
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const access = await getNavigationAccess();
  if (access.isBoardUser) redirect("/dashboard");
  if (access.isAccCommitteeMember) redirect("/acc-audit");

  const params = await searchParams;
  const error = params?.error;

  return <main className="auth-shell"><section className="card auth-card"><h1>Sign in</h1><p>Use your authorized HOA board or ACC committee Supabase account to access protected dashboards.</p>{error ? <div className="auth-error" role="alert">{error}</div> : null}<form action={signIn} className="auth-form"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /><button type="submit">Sign in</button></form></section></main>;
}
