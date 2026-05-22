const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type EditAction =
  | "improve"
  | "fix"
  | "shorten"
  | "lengthen"
  | "continue"
  | "tone";

export type Tone =
  | "professional"
  | "casual"
  | "friendly"
  | "witty"
  | "confident";

interface StreamEditOpts {
  action: EditAction;
  text: string;
  tone?: Tone;
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

/**
 * Stream an AI edit. Calls onDelta(text) for each chunk as it arrives.
 * Resolves when the stream ends. Throws on HTTP error or abort.
 */
export async function streamEdit(opts: StreamEditOpts): Promise<void> {
  const res = await fetch(`${API_URL}/ai/edit`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: opts.action,
      text: opts.text,
      tone: opts.tone,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `AI request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) opts.onDelta(decoder.decode(value, { stream: true }));
  }
}

export async function suggestTitles(content: string): Promise<string[]> {
  const res = await fetch(`${API_URL}/ai/title`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Title suggestion failed (${res.status})`);
  return (await res.json()) as string[];
}

export async function summarize(content: string): Promise<string> {
  const res = await fetch(`${API_URL}/ai/summarize`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Summarize failed (${res.status})`);
  return (await res.text()).replace(/^"|"$/g, "");
}
