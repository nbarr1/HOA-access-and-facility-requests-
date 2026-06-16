function normalizeBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, "") || undefined;
}

function isLocalBaseUrl(value: string | undefined) {
  return Boolean(value && /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value));
}

function vercelBaseUrl() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : undefined;
}

function forwardedBaseUrl(headersList: Headers) {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return undefined;
  const proto = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function getAppBaseUrl(headersList: Headers) {
  const configured = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? normalizeBaseUrl(process.env.HOA_APP_BASE_URL);
  if (configured && (process.env.NODE_ENV !== "production" || !isLocalBaseUrl(configured))) return configured;

  return forwardedBaseUrl(headersList) ?? vercelBaseUrl() ?? configured ?? "http://localhost:3000";
}
