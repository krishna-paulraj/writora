import { getActiveSiteId } from "./active-site";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Central API fetch for the dashboard. Always sends credentials and tags the
 * request with the active site (X-Writora-Site) so site-scoped endpoints
 * (blogs, categories, subscribers, AI, content plans, publish) resolve to the
 * site the user has selected. Account-level calls ignore the header harmlessly.
 */
export async function apiFetch(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(opts.headers);
  const siteId = getActiveSiteId();
  if (siteId) headers.set("X-Writora-Site", siteId);
  return fetch(`${API_URL}${path}`, {
    ...opts,
    credentials: "include",
    headers,
  });
}

/** Reads the JSON error `message` (Nest's shape) or falls back. */
export async function apiError(
  res: Response,
  fallback: string,
): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const j = JSON.parse(body) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(", ");
    if (j.message) return j.message;
  } catch {
    // not json
  }
  return body || `${fallback} (${res.status})`;
}
