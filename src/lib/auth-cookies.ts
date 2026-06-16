import { cookies } from "next/headers";
import { requiredEnv } from "./env";

type StoredSupabaseSession = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
};

function getSupabaseProjectRef() {
  const url = new URL(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"));
  return url.hostname.split(".")[0];
}

export function getSupabaseAuthCookieName() {
  return `sb-${getSupabaseProjectRef()}-auth-token`;
}

export function encodeSupabaseAuthCookie(session: StoredSupabaseSession) {
  return `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`;
}

export function decodeSupabaseAuthCookie(value: string): StoredSupabaseSession | null {
  try {
    const payload = value.startsWith("base64-") ? Buffer.from(value.slice("base64-".length), "base64url").toString("utf8") : value;
    const parsed = JSON.parse(payload) as StoredSupabaseSession | [string] | string[];
    if (Array.isArray(parsed)) return { access_token: typeof parsed[0] === "string" ? parsed[0] : undefined };
    return parsed;
  } catch {
    return null;
  }
}

export async function getSupabaseAccessTokenFromCookies() {
  const cookieStore = await cookies();
  const cookieName = getSupabaseAuthCookieName();
  const exactCookie = cookieStore.get(cookieName);
  const chunkedCookieValue = cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith(`${cookieName}.`))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((cookie) => cookie.value)
    .join("");
  const storedSession = decodeSupabaseAuthCookie(exactCookie?.value ?? chunkedCookieValue);
  return storedSession?.access_token ?? null;
}

export async function setSupabaseAuthCookies(session: StoredSupabaseSession) {
  const cookieStore = await cookies();
  const maxAge = session.expires_at ? Math.max(session.expires_at - Math.floor(Date.now() / 1000), 0) : session.expires_in;

  cookieStore.set(getSupabaseAuthCookieName(), encodeSupabaseAuthCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

export async function clearSupabaseAuthCookies() {
  const cookieStore = await cookies();
  const cookieName = getSupabaseAuthCookieName();
  const authCookies = cookieStore.getAll().filter((cookie) => cookie.name === cookieName || cookie.name.startsWith(`${cookieName}.`));

  for (const cookie of authCookies.length > 0 ? authCookies : [{ name: cookieName }]) {
    cookieStore.set(cookie.name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
}
