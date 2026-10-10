// A4.4 checks: npx tsx --env-file=api/.env scripts/ask.ts [--url http://localhost:4000] [--dataset replay] ["question" | --brief [hi]]
// With no question, runs the five track A tests. Without --url, calls the runner in-process (STORE_FILE or snapshot).
import type { AskRequest, AskResponse } from '@wajah/shared';
import { ask } from '../api/src/modules/agent/run';
import { getStore } from '../api/src/store';

const argv = process.argv.slice(2);
const opt = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const url = opt('--url');
const dataset = (opt('--dataset') ?? 'replay') as 'replay' | 'live';
const free = argv.filter((a, i) => !a.startsWith('--') && !['--url', '--dataset', '--gap'].includes(argv[i - 1] ?? ''));

async function call(req: AskRequest): Promise<AskResponse & { ms: number }> {
  const t = Date.now();
  const r = url
    ? ((await (await fetch(`${url.replace(/\/$/, '')}/ask`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) })).json()) as AskResponse)
    : await ask(await getStore(), req);
  return { ...r, ms: Date.now() - t };
}

const tests: { name: string; req: AskRequest }[] = argv.includes('--brief')
  ? [{ name: 'brief', req: { mode: 'brief', dataset, lang: argv.includes('hi') ? 'hi' : 'en' } }]
  : free.length
    ? [{ name: 'question', req: { message: free.join(' '), dataset } }]
    : [
        { name: '1 Anand Vihar (EN)', req: { message: 'Why was Anand Vihar so bad this afternoon?', dataset } },
        { name: '2 Jahangirpuri (HI)', req: { message: 'कल रात जहाँगीरपुरी में हवा इतनी खराब क्यों थी?', dataset } },
        { name: '3 What works at Mundka', req: { message: 'What works at Mundka?', dataset } },
        { name: '4 Brief (EN)', req: { mode: 'brief', dataset, lang: 'en' } },
        { name: '5 Off-topic', req: { message: 'Who will win the cricket match?', dataset } },
      ];

const gap = Number(opt('--gap') ?? 0);
for (const [k, t] of tests.entries()) {
  if (k && gap) await new Promise((r) => setTimeout(r, gap * 1000)); // free-tier quota is per minute
  const r = await call(t.req);
  console.log(`\n=== ${t.name}  (${(r.ms / 1000).toFixed(1)} s)`);
  console.log(r.answer);
  console.log(`evidence: ${r.evidence.length} chips${r.evidence.length ? ` (${r.evidence.map((e) => e.label).slice(0, 2).join('; ')})` : ''} | incidentId: ${r.incidentId ?? '-'} | actions: ${r.suggestedActions.map((a) => a.type).join(', ') || '-'}`);
}
