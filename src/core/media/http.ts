// Helpers HTTP compartidos por los conectores de media (fal/heygen/elevenlabs/gemini).

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 60000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  ms = 60000,
): Promise<T> {
  const r = await fetchWithTimeout(url, init, ms);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} en ${url}: ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}

/** Espera ms milisegundos (para polling de jobs asincronos). */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
