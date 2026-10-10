import { config } from '@wajah/shared';

/** fetch with the external-call timeout. Throws on HTTP errors with the status in the message (never the URL, which may hold a key). */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, label = 'request'): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(config.external.timeoutMs) });
  if (!res.ok) {
    const err = new Error(`${label} failed: HTTP ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return res;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Start of the hour, UTC, as ISO. */
export const hourIso = (ms: number) => new Date(Math.floor(ms / 3600_000) * 3600_000).toISOString();
