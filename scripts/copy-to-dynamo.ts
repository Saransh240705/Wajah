// A6.5: copy a local MemoryStore file (STORE_FILE) into the deployed DynamoDB tables and S3 bucket, so AWS gets
// exactly the data checked locally without fetching from the sources again. Table names come from the stack outputs.
// npx tsx scripts/copy-to-dynamo.ts .data/store.json [--dataset replay|live] [--stack wajah]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Dataset, Reading } from '@wajah/shared';
import { DynamoStore } from '../api/src/store/dynamo';
import type { StoreDump } from '../api/src/store/types';

const file = process.argv[2] ?? '.data/store.json';
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const only = arg('--dataset') as Dataset | undefined;
const stack = arg('--stack') ?? 'wajah';

const outputs = JSON.parse(execFileSync('aws', ['cloudformation', 'describe-stacks', '--stack-name', stack, '--query', 'Stacks[0].Outputs', '--output', 'json'], { encoding: 'utf8' })) as { OutputKey: string; OutputValue: string }[];
const out = (k: string) => outputs.find((o) => o.OutputKey === k)!.OutputValue;
const store = new DynamoStore({ readingsTable: out('ReadingsTableName'), incidentsTable: out('IncidentsTableName'), bucket: out('EvidenceBucketName') });
const dump = JSON.parse(readFileSync(file, 'utf8')) as StoreDump;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

for (const ds of (['replay', 'live'] as Dataset[]).filter((d) => !only || d === only)) {
  const readings = dump.readings[ds] ?? [];
  const byStation = new Map<string, Reading[]>();
  for (const r of readings) byStation.set(r.stationId, [...(byStation.get(r.stationId) ?? []), r]);
  const t0 = Date.now();
  await pool([...byStation.values()], 8, (rows) => store.putReadings(ds, rows));
  await store.putWeather(ds, dump.weather[ds] ?? []);
  const fires = Object.entries(dump.fires[ds] ?? {});
  await pool(fires, 8, ([day, rows]) => store.putFires(ds, day, rows));
  // Keep lifecycle state made on AWS (work orders issued there, workflow verdicts): the local copy brings the
  // diagnosis, the remote copy wins on work orders, status, checks and escalation when it has more work orders.
  const remote = new Map((await store.listIncidents({ dataset: ds })).map((i) => [i.id, i]));
  let merged = 0;
  const incidents = dump.incidents.filter((i) => i.dataset === ds).map((i) => {
    const r = remote.get(i.id);
    if (!r || r.workOrders.length <= i.workOrders.length) return i;
    merged++;
    return { ...i, workOrders: r.workOrders, status: r.status, checks: r.checks, recurrenceCount: r.recurrenceCount, escalationLevel: r.escalationLevel, updatedAt: r.updatedAt };
  });
  await pool(incidents, 8, (i) => store.putIncident(i));
  if (merged) console.log(`[${ds}] kept AWS work orders on ${merged} incident(s)`);
  console.log(`[${ds}] ${readings.length} readings (${byStation.size} stations), ${(dump.weather[ds] ?? []).length} weather rows, ${fires.length} fire days, ${incidents.length} incidents in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
