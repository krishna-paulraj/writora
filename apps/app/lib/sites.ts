import { apiError, apiFetch } from "./api";

export interface Site {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  isPrimary: boolean;
  blogTheme: string;
  customDomain: string | null;
  bio: string | null;
  avatarUrl: string | null;
  twitterHandle: string | null;
  websiteUrl: string | null;
  imageStyle: string;
  autoGenerateImages: boolean;
  createdAt: string;
}

export async function listSites(): Promise<Site[]> {
  const res = await apiFetch("/sites");
  if (!res.ok) throw new Error(await apiError(res, "Failed to load sites"));
  return (await res.json()) as Site[];
}

export async function createSite(input: {
  name: string;
  slug: string;
  blogTheme?: string;
}): Promise<Site> {
  const res = await apiFetch("/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to create site"));
  return (await res.json()) as Site;
}

export async function updateSite(
  id: string,
  patch: Partial<{
    name: string;
    slug: string;
    blogTheme: string;
    bio: string | null;
    avatarUrl: string | null;
    twitterHandle: string | null;
    websiteUrl: string | null;
    imageStyle: string;
    autoGenerateImages: boolean;
  }>,
): Promise<Site> {
  const res = await apiFetch(`/sites/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to update site"));
  return (await res.json()) as Site;
}

export async function setSiteDomain(
  id: string,
  customDomain: string | null,
): Promise<Site> {
  const res = await apiFetch(`/sites/${id}/domain`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customDomain }),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to set domain"));
  return (await res.json()) as Site;
}

export async function deleteSite(id: string): Promise<void> {
  const res = await apiFetch(`/sites/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await apiError(res, "Failed to delete site"));
}
