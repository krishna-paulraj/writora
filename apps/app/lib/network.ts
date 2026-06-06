import { apiError, apiFetch } from "./api";

export interface NetworkMembership {
  siteId: string;
  enabled: boolean;
  relPolicy: "dofollow" | "nofollow";
  maxOutboundPerPost: number;
  niche: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NetworkPatch = Partial<{
  enabled: boolean;
  relPolicy: "dofollow" | "nofollow";
  maxOutboundPerPost: number;
  niche: string | null;
}>;

export interface NetworkOverview {
  membership: NetworkMembership | null;
  stats: { inbound: number; outbound: number };
}

/** Membership + stats for the active site (X-Writora-Site header). */
export async function getNetwork(): Promise<NetworkOverview> {
  const res = await apiFetch("/network");
  if (!res.ok) throw new Error(await apiError(res, "Failed to load network"));
  return (await res.json()) as NetworkOverview;
}

export async function updateNetwork(
  patch: NetworkPatch,
): Promise<NetworkMembership> {
  const res = await apiFetch("/network", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to save network"));
  return (await res.json()) as NetworkMembership;
}
