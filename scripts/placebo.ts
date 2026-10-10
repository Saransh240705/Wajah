// A6.3 placebo test: npx tsx --env-file-if-exists=api/.env scripts/placebo.ts --dataset replay
// Writes { tested, wronglyWorked } to shared/src/placebo.json. The result is reported as it is, whatever it is.
// `tested` counts fakes that got a worked or no_effect verdict; inconclusive fakes are reported but not counted.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset } from '@wajah/shared';
import { datasetNow } from '../api/src/lib/clock';
import { runPlacebo } from '../api/src/modules/effect/placebo';
import { getStore } from '../api/src/store';

const i = process.argv.indexOf('--dataset');
const dataset = (i >= 0 ? process.argv[i + 1] : 'replay') as Dataset;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'src', 'placebo.json');

const store = await getStore();
const r = await runPlacebo(store, dataset, await datasetNow(store, dataset));
const counts = r.rows.reduce<Record<string, number>>((a, x) => ((a[x.verdict] = (a[x.verdict] ?? 0) + 1), a), {});
console.log(`Placebo test on ${dataset}: ${r.rows.length} unacted incidents`);
console.log(`  verdicts: ${JSON.stringify(counts)}`);
console.log(`  wrongly marked worked: ${r.wronglyWorked} of ${r.tested} judged (${r.tested ? ((100 * r.wronglyWorked) / r.tested).toFixed(1) : '0'}%), ${r.inconclusive} inconclusive`);
const notes = r.rows.filter((x) => x.note).reduce<Record<string, number>>((a, x) => {
  for (const n of x.note!.split('; ')) a[n.replace(/\(.*\)/, '').trim()] = (a[n.replace(/\(.*\)/, '').trim()] ?? 0) + 1;
  return a;
}, {});
console.log(`  notes: ${JSON.stringify(notes)}`);
if (process.argv.includes('--dry-run')) process.exit(0);
writeFileSync(out, JSON.stringify({ tested: r.tested, wronglyWorked: r.wronglyWorked }, null, 2) + '\n');
console.log(`wrote ${out}`);
