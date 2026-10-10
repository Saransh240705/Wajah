// A6.4: add work orders marked demo:true to some replay incidents and measure them. Verdicts are whatever the
// real readings give: most should be no_effect, because nothing was actually done.
// npx tsx --env-file-if-exists=api/.env scripts/demo-workorders.ts --dataset replay [--count 6] [--ids id1,id2]
import { PLAYBOOKS, type Dataset, type Incident } from '@wajah/shared';
import { finishWorkOrder, issueWorkOrder, measureWorkOrder, startWorkOrder } from '../api/src/modules/workorders/service';
import { getStore } from '../api/src/store';

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dataset = (arg('--dataset') ?? 'replay') as Dataset;
const count = Number(arg('--count') ?? 6);
const ids = arg('--ids')?.split(',');

const store = await getStore();
const all = await store.listIncidents({ dataset });
let picks: Incident[];
if (ids) picks = all.filter((i) => ids.includes(i.id));
else {
  // Local causes only (advisories are never measured), spread across causes and stations, closed windows only
  const pool = all.filter((i) => i.workOrders.length === 0 && i.end && PLAYBOOKS[i.topCause].localActionPossible && i.confidence !== 'low');
  picks = [];
  const seen = new Set<string>();
  for (const pass of [0, 1, 2]) for (const i of pool) {
    if (picks.length >= count) break;
    const key = pass === 0 ? `${i.topCause}` : pass === 1 ? `${i.stationId}` : i.id;
    if (seen.has(key) || picks.includes(i)) continue;
    seen.add(key);
    picks.push(i);
  }
}
if (!picks.length) {
  console.log('No suitable incidents found.');
  process.exit(1);
}
for (const inc of picks) {
  const { workOrder } = await issueWorkOrder(store, inc.id, { demo: true });
  await startWorkOrder(store, workOrder.id);
  await finishWorkOrder(store, workOrder.id);
  const m = await measureWorkOrder(store, workOrder.id);
  const e = m.workOrder.effect;
  console.log(`${workOrder.id}  ${inc.topCause}/${inc.confidence}  ${workOrder.actionType}  ->  ${e ? `${e.verdict}, net ${e.netChangePct}% (change ${e.changePct}%, expected ${e.expectedChangePct}%)${e.note ? `, ${e.note}` : ''}` : 'not measured (after window incomplete)'}`);
}
