import { apiError, apiFetch } from "./api";

export type PlanName = "free" | "pro" | "business";

export interface PlanLimits {
  sites: number;
  aiArticlesPerMonth: number;
  autopilot: boolean;
  destinations: number;
  customDomain: boolean;
  backlinkNetwork: boolean;
}

export interface Entitlements {
  plan: PlanName;
  status: string | null;
  currentPeriodEnd: string | null;
  limits: PlanLimits;
  usage: { aiArticlesThisMonth: number; sites: number; destinations: number };
}

export interface MeSite {
  id: string;
  name: string;
  slug: string;
  isPrimary: boolean;
  blogTheme: string;
  customDomain: string | null;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  username: string;
  plan: PlanName;
  entitlements: Entitlements;
  sites: MeSite[];
  avatarUrl: string | null;
}

export async function getMe(): Promise<Me> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw new Error(await apiError(res, "Failed to load account"));
  return (await res.json()) as Me;
}
