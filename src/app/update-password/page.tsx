import { clearSupabaseAuthCookies, getSupabaseSessionFromCookies } from "@/lib/auth-cookies";
import { createSupabasePublicClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type UpdatePasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

async function updatePassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) redirect("/update-password?error=Password%20must%20be%20at%20least%208%20characters.");
  if (password !== confirmPassword) redirect("/update-password?error=Passwords%20do%20not%20match.");

  const session = await getSupabaseSessionFromCookies();
  if (!session?.access_token || !session.refresh_token) redirect("/password/reset?error=Your%20password%20link%20expired.%20Please%20request%20a%20new%20one.");

  const supabase = createSupabasePublicClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (sessionError || !sessionData.session) redirect("/password/reset?error=Your%20password%20link%20expired.%20Please%20request%20a%20new%20one.");

  const { data, error } = await supabase.auth.updateUser({ password });
  if (error || !data.user) redirect(`/update-password?error=${encodeURIComponent(error?.message ?? "Unable to update password.")}`);

  await clearSupabaseAuthCookies();
  redirect("/login?message=Password%20updated.%20Please%20sign%20in%20with%20your%20new%20password.");
}

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const params = await searchParams;
  const session = await getSupabaseSessionFromCookies();
  if (!session?.access_token) redirect("/password/reset?error=Please%20request%20a%20password%20link%20first.");

  return <main className="auth-shell"><section className="card auth-card"><h1>Choose a new password</h1><p>Create a password for future HOA dashboard sign-ins. Use at least 8 characters.</p>{params?.error ? <div className="auth-error" role="alert">{params.error}</div> : null}<form action={updatePassword} className="auth-form"><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /><label htmlFor="confirm_password">Confirm new password</label><input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={8} required /><button type="submit">Save new password</button></form></section></main>;
}
