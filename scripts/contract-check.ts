// Checks a running API against the version 2 contract (master PRD section 10), using the fixtures as the
// reference shapes. Read-only unless --write, which also runs issue -> start -> done -> measure on one incident.
//
// npx tsx scripts/contract-check.ts [baseUrl=http://localhost:4000] [--dataset replay] [--write] [--agent <AGENT_URL>]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = (args.find((a) => /^https?:/.test(a)) ?? process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const dataset = flag('--dataset') ?? 'live';
const write = args.includes('--write');
const agentUrl = flag('--agent');
const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'fixtures');
const fixture = (name: string) => JSON.parse(readFileSync(join(FIX, name), 'utf8'));

let failures = 0;
const ok = (msg: string) => console.log(`  ok    ${msg}`);
const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`); };
const skip = (msg: string) => console.log(`  skip  ${msg}`);

/** Every key in `ref` exists in `got` with a compatible type, recursively (first array element only). */
function shape(got: unknown, ref: unknown, path = '$'): string[] {
  if (ref === null || got === null) return [];
  if (Array.isArray(ref)) {
    if (!Array.isArray(got)) return [`${path}: expected array`];
    return ref.length && got.length ? shape(got[0], ref[0], `${path}[0]`) : [];
  }
  if (typeof ref === 'object') {
    if (typeof got !== 'object' || Array.isArray(got)) return [`${path}: expected object`];
    const errs: string[] = [];
    for (const [k, v] of Object.entries(ref as object)) {
      // optional fields in the contract: present in some fixtures, absent in others
      if (!(k in (got as object))) {
        if (['photo', 'effect', 'startedAt', 'doneAt', 'executionArn', 'overdueNotified', 'demo', 'note', 'evidenceKey', 'incidentId', 'payload', 'openaqLocationId', 'cpcbName'].includes(k)) continue;
        errs.push(`${path}.${k}: missing`);
        continue;
      }
      errs.push(...shape((got as Record<string, unknown>)[k], v, `${path}.${k}`));
    }
    return errs;
  }
  return typeof got === typeof ref ? [] : [`${path}: expected ${typeof ref}, got ${typeof got}`];
}

async function call(method: string, path: string, body?: unknown, url = base) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${path}${method === 'GET' && !path.startsWith('/work-orders') ? `${sep}dataset=${dataset}` : ''}`, {
    method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

async function check(name: string, method: string, path: string, ref: unknown, opts: { status?: number; body?: unknown; optional?: boolean } = {}) {
  try {
    const r = await call(method, path, opts.body);
    if (opts.optional && r.status === 404) return skip(`${method} ${path} (not mounted yet)`), null;
    if (r.status !== (opts.status ?? 200)) return fail(`${method} ${path}: HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`), null;
    const errs = ref === undefined ? [] : shape(r.json, ref);
    if (errs.length) fail(`${name}: ${errs.slice(0, 4).join('; ')}`);
    else ok(`${method} ${path}`);
    return r.json;
  } catch (e) {
    fail(`${method} ${path}: ${(e as Error).message}`);
    return null;
  }
}

console.log(`Contract check against ${base} (dataset=${dataset}${write ? ', write' : ''})`);
const incidentsRef = fixture('incidents.json') as { id: string; workOrders: unknown[] }[];
const woRef = incidentsRef.flatMap((i) => i.workOrders).find((w) => (w as { effect?: unknown }).effect)!;

await check('health', 'GET', '/health', { ok: true });
const stations = (await check('stations', 'GET', '/stations', fixture('stations.json'))) as { id: string }[] | null;
const sid = stations?.find((s) => s.id === 'anand-vihar')?.id ?? stations?.[0]?.id ?? 'anand-vihar';
await check('readings', 'GET', `/stations/${sid}/readings?hours=48`, { ...fixture('readings-rohini.json'), incidents: [] });
const list = (await check('incidents', 'GET', '/incidents?limit=5', incidentsRef)) as { id: string; status: string; topCause: string }[] | null;
if (list?.length) await check('incident', 'GET', `/incidents/${list[0]!.id}`, incidentsRef[0]);
else skip('GET /incidents/:id (no incidents in this dataset)');
await check('incident 404', 'GET', '/incidents/does-not-exist', { error: { code: '', message: '' } }, { status: 404 });
await check('fires', 'GET', '/fires?hours=48', fixture('fires.json'));
await check('scoreboard', 'GET', '/scoreboard', fixture('scoreboard.json'));
await check('board', 'GET', '/board', fixture('board.json'), { optional: true });
await check('ledger', 'GET', '/ledger', fixture('ledger.json'), { optional: true });
await check('work order 404', 'GET', '/work-orders/does-not-exist-w1', { error: { code: '', message: '' } }, { status: 404 });

if (write) {
  const target = list?.find((i) => i.status === 'open' && !['regional_smoke', 'trapped_air'].includes(i.topCause));
  if (!target) skip('work order flow (no open incident with a local cause)');
  else {
    const issued = (await check('issue', 'POST', `/incidents/${target.id}/work-orders`, { incident: incidentsRef[0], workOrder: { ...(woRef as object), effect: undefined } }, { status: 201 })) as { workOrder: { id: string } } | null;
    if (issued) {
      const id = issued.workOrder.id;
      await check('get work order', 'GET', `/work-orders/${id}`, { workOrder: {}, incident: incidentsRef[0] });
      await check('start', 'POST', `/work-orders/${id}/start`, {});
      await check('start twice', 'POST', `/work-orders/${id}/start`, { error: { code: 'invalid_state', message: '' } }, { status: 409 });
      await check('done', 'POST', `/work-orders/${id}/done`, {});
      const m = (await check('measure', 'POST', `/work-orders/${id}/measure`, {})) as { effect?: { verdict: string; netChangePct: number } } | null;
      if (m?.effect) ok(`effect: ${m.effect.verdict}, net ${m.effect.netChangePct}%`);
      else skip('effect not measured yet (after window not complete for this dataset clock)');
    }
  }
} else {
  skip('work order flow (pass --write to issue a work order)');
}

if (agentUrl) {
  const ask = fixture('ask.json');
  for (const mode of ['ask', 'brief'] as const) {
    try {
      const r = await call('POST', '/ask', mode === 'ask' ? { mode, message: 'Why was Anand Vihar so bad today?', dataset } : { mode, dataset, lang: 'en' }, agentUrl.replace(/\/$/, ''));
      const errs = r.status === 200 ? shape(r.json, ask[mode]) : [`HTTP ${r.status}`];
      if (errs.length) fail(`POST /ask (${mode}): ${errs.join('; ')}`);
      else ok(`POST /ask (${mode})`);
    } catch (e) {
      fail(`POST /ask (${mode}): ${(e as Error).message}`);
    }
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
