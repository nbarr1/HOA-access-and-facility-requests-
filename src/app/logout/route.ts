import { clearSupabaseAuthCookies } from "@/lib/auth-cookies";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await clearSupabaseAuthCookies();
  return NextResponse.redirect(new URL("/login", request.url));
}
