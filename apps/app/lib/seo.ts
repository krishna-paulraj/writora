const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SeoScoreResult {
  score: number;
  checks: SeoCheck[];
  wordCount: number;
  keywordDensity: number;
}

export interface ScoreSeoInput {
  title?: string;
  description?: string;
  contentHtml?: string;
  targetKeyword?: string;
  length?: "short" | "medium" | "long";
}

export async function scoreSeo(input: ScoreSeoInput): Promise<SeoScoreResult> {
  const res = await fetch(`${API_URL}/seo/score`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`SEO scoring failed (${res.status})`);
  return (await res.json()) as SeoScoreResult;
}
