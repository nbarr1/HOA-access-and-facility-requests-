"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthConfirmPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresAt = params.get("expires_at");
    const expiresIn = params.get("expires_in");
    const tokenType = params.get("token_type") ?? "bearer";

    if (!accessToken || !refreshToken) {
      router.replace("/password/reset?error=Invalid%20or%20expired%20link.");
      return;
    }

    fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt ? Number(expiresAt) : undefined,
        expires_in: expiresIn ? Number(expiresIn) : undefined,
        token_type: tokenType,
      }),
    })
      .then((res) => {
        if (res.ok) {
          router.replace("/update-password");
        } else {
          router.replace("/password/reset?error=Unable%20to%20complete%20sign%20in.");
        }
      })
      .catch(() => {
        router.replace("/password/reset?error=Unable%20to%20complete%20sign%20in.");
      });
  }, [router]);

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <p>Completing sign in…</p>
      </section>
    </main>
  );
}
