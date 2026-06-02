// The dashboard's "active site" — persisted in localStorage and sent on every
// API request as the X-Writora-Site header (see lib/api.ts). The backend
// validates ownership and falls back to the primary site, so a stale/missing
// value is always safe.
const KEY = "writora_active_site";

export function getActiveSiteId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setActiveSiteId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    // ignore (private mode / disabled storage)
  }
  // Also set a cookie as the SiteContextGuard's fallback signal. Host-only (no
  // domain) so it reaches the API on localhost (cookies ignore port) in dev;
  // the X-Writora-Site header (apiFetch) is the cross-origin-safe path in prod.
  try {
    document.cookie = id
      ? `writora_site=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`
      : `writora_site=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // ignore
  }
}
