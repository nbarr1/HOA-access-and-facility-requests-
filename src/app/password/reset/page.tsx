import { createSupabasePublicClient } from "@/lib/supabase";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PasswordResetPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};

function siteOrigin(headersList: Headers) {
  return headersList.get("origin") ?? process.env.HOA_APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function sendPasswordResetEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/password/reset?error=Email%20is%20required.");

  const origin = siteOrigin(await headers());
  const supabase = createSupabasePublicClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/update-password` });
  if (error) redirect(`/password/reset?error=${encodeURIComponent(error.message)}`);

  redirect("/password/reset?message=Check%20your%20email%20for%20a%20secure%20password%20reset%20link.");
}

export default async function ResetPasswordPage({ searchParams }: PasswordResetPageProps) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="card auth-card"><h1>Reset your password</h1><p>Enter your account email and we will send a secure link to choose a new password.</p>{params?.error ? <div className="auth-error" role="alert">{params.error}</div> : null}{params?.message ? <div className="auth-message" role="status">{params.message}</div> : null}<form action={sendPasswordResetEmail} className="auth-form"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /><button type="submit">Send password reset link</button></form><div className="auth-links"><a href="/login">Back to sign in</a><a href="/password/new">I need to create my first password</a></div></section></main>;
}
