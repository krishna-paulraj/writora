const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface KeywordResult {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  competition: number | null;
  cpc: number | null;
  seed: string;
}

export interface SavedKeyword {
  id: string;
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  competition: number | null;
  cpc: number | null;
  seed: string | null;
  createdAt: string;
}

export interface SaveKeywordInput {
  keyword: string;
  searchVolume?: number | null;
  difficulty?: number | null;
  competition?: number | null;
  cpc?: number | null;
  seed?: string | null;
}

/** Research keyword ideas for a seed via DataForSEO. Throws on 503 if unconfigured. */
export async function researchKeywords(seed: string): Promise<KeywordResult[]> {
  const res = await fetch(`${API_URL}/keywords/research`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Keyword research failed (${res.status})`);
  }
  return (await res.json()) as KeywordResult[];
}

export async function listSavedKeywords(): Promise<SavedKeyword[]> {
  const res = await fetch(`${API_URL}/keywords/saved`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load saved keywords (${res.status})`);
  return (await res.json()) as SavedKeyword[];
}

export async function saveKeyword(kw: SaveKeywordInput): Promise<SavedKeyword> {
  const res = await fetch(`${API_URL}/keywords/saved`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kw),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Failed to save keyword (${res.status})`);
  }
  return (await res.json()) as SavedKeyword;
}

export async function deleteSavedKeyword(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/keywords/saved/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to delete keyword (${res.status})`);
}
