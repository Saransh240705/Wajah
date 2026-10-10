import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class HttpError extends Error {
  constructor(readonly status: ContentfulStatusCode, readonly code: string, message: string) {
    super(message);
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found.`);

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

/** Error handler for the Hono app: known errors keep their code, the rest become 500 internal and are logged. */
export function onError(err: Error, c: Context) {
  const e = err as Error & { status?: number; code?: string };
  if (e instanceof HttpError || (typeof e.status === 'number' && typeof e.code === 'string')) {
    return c.json(errorBody(e.code!, e.message), e.status as ContentfulStatusCode);
  }
  console.error(JSON.stringify({ level: 'error', path: c.req.path, method: c.req.method, message: err.message, stack: err.stack }));
  return c.json(errorBody('internal', 'Something went wrong.'), 500);
}

export function intParam(v: string | undefined, fallback: number, max = 10_000): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback;
}
