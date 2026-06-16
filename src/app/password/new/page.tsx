import { createSupabasePublicClient } from "@/lib/supabase";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PasswordRequestPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};

function siteOrigin(headersList: Headers) {
  return headersList.get("origin") ?? process.env.HOA_APP_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

async function sendPasswordSetupEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/password/new?error=Email%20is%20required.");

  const origin = siteOrigin(await headers());
  const supabase = createSupabasePublicClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/update-password` });
  if (error) redirect(`/password/new?error=${encodeURIComponent(error.message)}`);

  redirect("/password/new?message=Check%20your%20email%20for%20a%20secure%20password%20setup%20link.");
}

export default async function NewPasswordPage({ searchParams }: PasswordRequestPageProps) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="card auth-card"><h1>Create your first password</h1><p>Enter the email address for your HOA dashboard account. We will send a secure link that lets you choose your password.</p>{params?.error ? <div className="auth-error" role="alert">{params.error}</div> : null}{params?.message ? <div className="auth-message" role="status">{params.message}</div> : null}<form action={sendPasswordSetupEmail} className="auth-form"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /><button type="submit">Send password setup link</button></form><div className="auth-links"><a href="/login">Back to sign in</a><a href="/password/reset">I need to reset an existing password</a></div></section></main>;
}
