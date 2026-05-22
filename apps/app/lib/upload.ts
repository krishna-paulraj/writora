const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
