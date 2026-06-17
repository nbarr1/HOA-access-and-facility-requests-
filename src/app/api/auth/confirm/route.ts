import { setSupabaseAuthCookies } from "@/lib/auth-cookies";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: { access_token?: string; refresh_token?: string; expires_at?: number; expires_in?: number; token_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { access_token, refresh_token, expires_at, expires_in, token_type } = body;
  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  await setSupabaseAuthCookies({ access_token, refresh_token, expires_at, expires_in, token_type });
  return NextResponse.json({ ok: true });
}
