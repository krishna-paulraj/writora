import { apiError, apiFetch } from "./api";

export type Cadence =
  | "daily"
  | "every_3_days"
  | "weekly"
  | "biweekly"
  | "monthly";
export type PlanStatus = "active" | "paused" | "completed";
export type ItemStatus =
  | "planned"
  | "queued"
  | "generating"
  | "done"
  | "failed"
  | "skipped";
export type Tone =
  | "professional"
  | "casual"
  | "friendly"
  | "witty"
  | "confident";
export type ArticleLength = "short" | "medium" | "long";

export interface PlanItemJob {
  id: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number;
  blogId: string | null;
  error: string | null;
}

export interface ContentPlanItem {
  id: string;
  title: string;
  targetKeyword: string | null;
  status: ItemStatus;
  position: number;
  scheduledFor: string | null;
  articleJobId: string | null;
  createdAt: string;
  job?: PlanItemJob | null;
}

export interface ContentPlan {
  id: string;
  title: string;
  topic: string;
  audience: string | null;
  tone: string;
  length: string;
  category: string | null;
  cadence: Cadence;
  status: PlanStatus;
  autoPublish: boolean;
  totalTarget: number | null;
  generatedCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPlanListItem extends ContentPlan {
  _count: { items: number };
}

export interface ContentPlanDetail extends ContentPlan {
  items: ContentPlanItem[];
}

export interface CreateContentPlanInput {
  title: string;
  topic: string;
  audience?: string;
  tone?: Tone;
  length?: ArticleLength;
  category?: string;
  cadence?: Cadence;
  articleCount?: number;
  totalTarget?: number | null;
  autoPublish?: boolean;
  targetKeyword?: string;
  relatedKeywords?: string[];
}

export interface UpdateContentPlanInput {
  title?: string;
  status?: PlanStatus;
  cadence?: Cadence;
  autoPublish?: boolean;
  totalTarget?: number | null;
}

export async function createContentPlan(
  input: CreateContentPlanInput,
): Promise<ContentPlanDetail> {
  const res = await apiFetch(`/content-plans`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to create plan"));
  return (await res.json()) as ContentPlanDetail;
}

export async function listContentPlans(): Promise<ContentPlanListItem[]> {
  const res = await apiFetch(`/content-plans`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to load plans"));
  return (await res.json()) as ContentPlanListItem[];
}

export async function getContentPlan(id: string): Promise<ContentPlanDetail> {
  const res = await apiFetch(`/content-plans/${id}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to load plan"));
  return (await res.json()) as ContentPlanDetail;
}

export async function updateContentPlan(
  id: string,
  patch: UpdateContentPlanInput,
): Promise<ContentPlan> {
  const res = await apiFetch(`/content-plans/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to update plan"));
  return (await res.json()) as ContentPlan;
}

export async function runContentPlan(id: string): Promise<{ jobId: string }> {
  const res = await apiFetch(`/content-plans/${id}/run`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to start article"));
  return (await res.json()) as { jobId: string };
}

export async function addPlanItem(
  id: string,
  body: {
    title: string;
    targetKeyword?: string;
    keywords?: string[];
    scheduledFor?: string;
  },
): Promise<ContentPlanItem> {
  const res = await apiFetch(`/content-plans/${id}/items`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to add idea"));
  return (await res.json()) as ContentPlanItem;
}

export async function deletePlanItem(
  id: string,
  itemId: string,
): Promise<void> {
  const res = await apiFetch(`/content-plans/${id}/items/${itemId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to remove idea"));
}

export async function deleteContentPlan(id: string): Promise<void> {
  const res = await apiFetch(`/content-plans/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to delete plan"));
}

// --- Planner calendar feed -------------------------------------------------

export type PlannerVariant =
  | "scheduled"
  | "published"
  | "draft" // blogs
  | "ai-planned"
  | "ai-generating"; // plan items

export interface PlannerBlogEvent {
  kind: "blog";
  id: string;
  title: string;
  slug: string;
  start: string;
  end: string;
  variant: "scheduled" | "published" | "draft";
  published: boolean;
  scheduledAt: string | null;
}

export interface PlannerPlanEvent {
  kind: "plan";
  id: string; // the plan-item id
  planId: string;
  planTitle: string;
  title: string;
  start: string;
  end: string;
  variant: "ai-planned" | "ai-generating";
  status: ItemStatus;
}

export type PlannerEvent = PlannerBlogEvent | PlannerPlanEvent;

/** Unified, site-scoped feed: blog events + upcoming AI plan items. */
export async function getPlannerEvents(): Promise<PlannerEvent[]> {
  const res = await apiFetch(`/content-plans/calendar`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to load planner"));
  return (await res.json()) as PlannerEvent[];
}

/** Move (or park, with null) a planned AI article to a new date. */
export async function reschedulePlanItem(
  planId: string,
  itemId: string,
  scheduledFor: string | null,
): Promise<ContentPlanItem> {
  const res = await apiFetch(`/content-plans/${planId}/items/${itemId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scheduledFor }),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to reschedule"));
  return (await res.json()) as ContentPlanItem;
}

/** Quick-add an AI article for a calendar day (per-site "Quick adds" plan). */
export async function quickAddArticle(body: {
  title: string;
  scheduledFor: string;
  targetKeyword?: string;
  keywords?: string[];
}): Promise<{ planId: string; item: ContentPlanItem }> {
  const res = await apiFetch(`/content-plans/quick-add`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to add article"));
  return (await res.json()) as { planId: string; item: ContentPlanItem };
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Every day",
  every_3_days: "Every 3 days",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

/** Compact relative time, e.g. "in 2h", "3d ago", "now". */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  const hrs = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  if (mins < 1) return "now";
  const val = mins < 60 ? `${mins}m` : hrs < 24 ? `${hrs}h` : `${days}d`;
  return ms >= 0 ? `in ${val}` : `${val} ago`;
}
