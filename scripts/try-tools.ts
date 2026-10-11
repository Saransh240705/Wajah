// A4.2 check: runs each agent tool directly (no model call) and prints its JSON size.
// STORE_FILE=.data/store.json npx tsx --env-file=api/.env scripts/try-tools.ts [replay|live]
import { Agent } from '@strands-agents/sdk';
import type { Dataset } from '@wajah/shared';
import { datasetNow } from '../api/src/lib/clock';
import { getModel } from '../api/src/modules/agent/model';
import { buildTools, type ToolCapture } from '../api/src/modules/agent/tools';
import { getStore } from '../api/src/store';

const dataset = (process.argv[2] ?? 'replay') as Dataset;
const store = await getStore();
const now = await datasetNow(store, dataset);
const capture: ToolCapture = {};
const agent = new Agent({ model: await getModel(), tools: buildTools(store, dataset, now, capture), printer: false });
const inc = (await store.listIncidents({ dataset })).find((i) => i.end && i.topCause !== 'regional_smoke')!;
const calls: [string, Record<string, unknown>][] = [
  ['find_station', { query: 'जहाँगीरपुरी' }],
  ['get_readings', { stationId: inc.stationId, from: inc.start, to: inc.end! }],
  ['list_incidents', { stationId: inc.stationId }],
  ['diagnose', { stationId: inc.stationId, from: inc.start, to: inc.end! }],
  ['get_wind', { from: inc.start, to: inc.end! }],
  ['get_upwind_fires', { stationId: inc.stationId, at: inc.peakAt }],
  ['get_playbook', { cause: inc.topCause }],
  ['get_board', {}],
  ['get_ledger', {}],
];
for (const [name, input] of calls) {
  const t = Date.now();
  const r = await (agent.tool as Record<string, { invoke: (i: unknown) => Promise<unknown> }>)[name]!.invoke(input);
  const json = JSON.stringify(r);
  console.log(`${name.padEnd(17)} ${String(json.length).padStart(5)} bytes ${String(Date.now() - t).padStart(4)} ms  ${json.slice(0, 150)}`);
}
console.log('captured incident:', capture.incident?.id, '| diagnosis chips:', capture.diagnosis?.evidence.length);
