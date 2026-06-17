import { createSupabaseServiceClient } from "@/lib/supabase";
import { sendPasswordLink } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/site-url";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PasswordRequestPageProps = {
  searchParams?: Promise<{ error?: string; message?: string }>;
};


async function sendPasswordSetupEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/password/new?error=Email%20is%20required.");

  const origin = getAppBaseUrl(await headers());
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/confirm` },
  });
  // Treat "user not found" as success to prevent email enumeration.
  if (error?.message?.toLowerCase().includes("user not found")) redirect("/password/new?message=Check%20your%20email%20for%20a%20secure%20password%20setup%20link.");
  if (error || !data.properties?.action_link) redirect(`/password/new?error=${encodeURIComponent(error?.message ?? "Unable to generate password setup link.")}`);

  try {
    await sendPasswordLink(email, data.properties.action_link, true);
  } catch (err) {
    console.error("Failed to send password setup email:", err);
    redirect("/password/new?error=Unable%20to%20send%20email.%20Please%20try%20again.");
  }

  redirect("/password/new?message=Check%20your%20email%20for%20a%20secure%20password%20setup%20link.");
}

export default async function NewPasswordPage({ searchParams }: PasswordRequestPageProps) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="card auth-card"><h1>Create your first password</h1><p>Enter the email address for your HOA dashboard account. We will send a secure link that lets you choose your password.</p>{params?.error ? <div className="auth-error" role="alert">{params.error}</div> : null}{params?.message ? <div className="auth-message" role="status">{params.message}</div> : null}<form action={sendPasswordSetupEmail} className="auth-form"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /><button type="submit">Send password setup link</button></form><div className="auth-links"><a href="/login">Back to sign in</a><a href="/password/reset">I need to reset an existing password</a></div></section></main>;
}
