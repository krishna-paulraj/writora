export interface JsonResponse {
  ok: boolean;
  status: number;
  json: unknown;
  error: string | null;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Minimal JSON HTTP helper for outbound adapter calls: bounded timeout, never
 * throws (returns ok=false with an error string), best-effort JSON parse.
 */
export async function requestJson(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    // 'manual' refuses to follow redirects — used for user-controlled hosts so
    // a public site can't 30x-bounce the request into the internal network.
    redirect?: RequestRedirect;
  } = {},
): Promise<JsonResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      redirect: opts.redirect ?? 'follow',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Writora-Publish/1.0',
        ...(opts.body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    // With redirect:'manual', a redirect surfaces as an opaque response — treat
    // it as a failure rather than silently following it somewhere unsafe.
    if (
      res.type === 'opaqueredirect' ||
      (res.status >= 300 && res.status < 400)
    ) {
      return {
        ok: false,
        status: res.status,
        json: null,
        error:
          'The site redirected the request — use its canonical URL (https) instead',
      };
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      status: res.status,
      json,
      error: ok ? null : extractError(json, res.status, res.statusText),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, json: null, error: msg.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
}

function extractError(
  json: unknown,
  status: number,
  statusText: string,
): string {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.detail;
    if (typeof msg === 'string' && msg)
      return `HTTP ${status}: ${msg}`.slice(0, 500);
  }
  return `HTTP ${status} ${statusText}`.trim();
}
