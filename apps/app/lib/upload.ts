import { apiError, apiFetch } from "./api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface GenerateImageInput {
  kind?: "featured" | "inline";
  title?: string;
  heading?: string;
  description?: string;
  keyword?: string;
  prompt?: string;
  style?: string;
}

/**
 * Generate a blog image with AI (Recraft) and return its hosted URL. Uses the
 * active site's default style unless one is passed. Throws if the server has no
 * Recraft key configured (503).
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<string> {
  const res = await apiFetch("/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await apiError(res, "Failed to generate image"));
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_URL}/uploads/image`, {
    method: "POST",
    credentials: "include",
    body: fd,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || `Upload failed (${res.status})`);
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
