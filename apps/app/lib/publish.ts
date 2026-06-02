import { apiError, apiFetch } from "./api";

export type Platform = "wordpress" | "devto" | "x";

export const PLATFORM_LABELS: Record<Platform, string> = {
  wordpress: "WordPress",
  devto: "Dev.to",
  x: "X (Twitter)",
};

export interface PublishTarget {
  id: string;
  platform: Platform;
  name: string;
  enabled: boolean;
  autoPublish: boolean;
  lastPublishAt: string | null;
  lastStatus: string | null; // "ok" | "error"
  lastError: string | null;
  createdAt: string;
}

export interface PublishRecord {
  id: string;
  targetId: string;
  status: "pending" | "success" | "failed";
  externalUrl: string | null;
  error: string | null;
  updatedAt: string;
  // Present only on GET /publish/blogs/:id/records (listRecords); the POST
  // publish response returns the raw record without the nested target.
  target?: { id: string; platform: Platform; name: string };
}

export interface WordPressCredentials {
  siteUrl: string;
  token: string;
}
export interface DevtoCredentials {
  apiKey: string;
}
export interface XCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export type TargetCredentials =
  | WordPressCredentials
  | DevtoCredentials
  | XCredentials;

export interface AddTargetInput {
  platform: Platform;
  name: string;
  credentials: TargetCredentials;
  autoPublish?: boolean;
}

export async function listTargets(): Promise<PublishTarget[]> {
  const res = await apiFetch(`/publish/targets`, {
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(await apiError(res, "Failed to load destinations"));
  return (await res.json()) as PublishTarget[];
}

export async function addTarget(input: AddTargetInput): Promise<PublishTarget> {
  const res = await apiFetch(`/publish/targets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok)
    throw new Error(await apiError(res, "Failed to add destination"));
  return (await res.json()) as PublishTarget;
}

export async function updateTarget(
  id: string,
  patch: Partial<{
    name: string;
    enabled: boolean;
    autoPublish: boolean;
    credentials: TargetCredentials;
  }>,
): Promise<PublishTarget> {
  const res = await apiFetch(`/publish/targets/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok)
    throw new Error(await apiError(res, "Failed to update destination"));
  return (await res.json()) as PublishTarget;
}

export async function removeTarget(id: string): Promise<void> {
  const res = await apiFetch(`/publish/targets/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok)
    throw new Error(await apiError(res, "Failed to remove destination"));
}

export async function testTarget(
  id: string,
): Promise<{ ok: boolean; info?: string }> {
  const res = await apiFetch(`/publish/targets/${id}/test`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Test failed"));
  return (await res.json()) as { ok: boolean; info?: string };
}

export async function publishBlog(
  blogId: string,
  targetIds?: string[],
): Promise<PublishRecord[]> {
  const res = await apiFetch(`/publish/blogs/${blogId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetIds ? { targetIds } : {}),
  });
  if (!res.ok) throw new Error(await apiError(res, "Publish failed"));
  return (await res.json()) as PublishRecord[];
}

export async function listBlogRecords(
  blogId: string,
): Promise<PublishRecord[]> {
  const res = await apiFetch(`/publish/blogs/${blogId}/records`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to load records"));
  return (await res.json()) as PublishRecord[];
}
