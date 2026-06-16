import { cookies } from "next/headers";
import { requiredEnv } from "./env";

const AUTH_COOKIE_CHUNK_SIZE = 3800;

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
  const cookieName = getSupabaseAuthCookieName();
  const value = encodeSupabaseAuthCookie(session);
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };

  await clearSupabaseAuthCookies();

  if (value.length <= AUTH_COOKIE_CHUNK_SIZE) {
    cookieStore.set(cookieName, value, options);
    return;
  }

  for (let index = 0; index * AUTH_COOKIE_CHUNK_SIZE < value.length; index += 1) {
    cookieStore.set(`${cookieName}.${index}`, value.slice(index * AUTH_COOKIE_CHUNK_SIZE, (index + 1) * AUTH_COOKIE_CHUNK_SIZE), options);
  }
}

export async function clearSupabaseAuthCookies() {
  const cookieStore = await cookies();
  const cookieName = getSupabaseAuthCookieName();
  const authCookies = cookieStore.getAll().filter((cookie) => cookie.name === cookieName || cookie.name.startsWith(`${cookieName}.`));

  for (const cookie of authCookies.length > 0 ? authCookies : [{ name: cookieName }]) {
    cookieStore.set(cookie.name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
}
