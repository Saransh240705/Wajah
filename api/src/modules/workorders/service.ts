// Store-facing work order operations used by the API routes, the ingest fallback and the workflow.
import { ACTIONS, config, type ActionType, type Agency, type Dataset, type Incident, type PhotoCheck, type WorkOrder } from '@wajah/shared';
import { datasetNow } from '../../lib/clock';
import { HOTSPOT_IDS, STATIONS } from '../../lib/stations';
import type { Store } from '../../store';
import { afterWindowComplete, effectWindows, isUnacted, measureEffect, pollutantFor, type EffectInput } from '../effect/measure';
import { getRecommender } from './recommend';
import { applyEffect, finish, findWorkOrder, incidentIdOf, issue, start, WorkOrderError } from './workorders';

const MIN = 60_000;
const H = 3600_000;
const addMin = (iso: string, min: number) => new Date(Date.parse(iso) + min * MIN).toISOString();
const maxIso = (...xs: (string | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1)!;

export type WorkOrderEvent = 'issue' | 'start' | 'done';

/**
 * When an event happens. Live: the real clock. Replay: simulated relative to the incident (config.replayClock),
 * because replay's "now" is the end of the period and nothing after it has readings.
 */
export async function eventTime(store: Store, incident: Incident, event: WorkOrderEvent, wo?: WorkOrder): Promise<string> {
  if (incident.dataset === 'live') return datasetNow(store, 'live');
  const rc = config.replayClock;
  if (event === 'issue') {
    const lastActivity = incident.workOrders.map((w) => w.doneAt ?? w.startedAt ?? w.issuedAt);
    return maxIso(addMin(incident.start, rc.issueAfterStartMin), ...lastActivity.map((t) => addMin(t, rc.issueAfterStartMin)));
  }
  if (event === 'start') return addMin(wo!.issuedAt, rc.startAfterIssueMin);
  return addMin(wo!.startedAt ?? addMin(wo!.issuedAt, rc.startAfterIssueMin), rc.doneAfterStartMin);
}

export async function loadIncident(store: Store, incidentId: string): Promise<Incident> {
  const incident = await store.getIncident(incidentId);
  if (!incident) throw new WorkOrderError('not_found', `Incident ${incidentId} not found.`);
  return incident;
}

export async function loadWorkOrder(store: Store, workOrderId: string) {
  const incident = await loadIncident(store, incidentIdOf(workOrderId));
  return { incident, workOrder: findWorkOrder(incident, workOrderId) };
}

/** Median PM10 at the station over the baseline days before the incident, for "N times the usual level". */
async function usualPm10(store: Store, incident: Incident): Promise<number | null> {
  const to = incident.start;
  const from = new Date(Date.parse(to) - config.detect.baselineDays * 24 * H).toISOString();
  const vals = (await store.getReadings(incident.dataset, incident.stationId, from, to))
    .map((r) => r.pm10).filter((v): v is number => v != null).sort((a, b) => a - b);
  return vals.length ? vals[Math.floor(vals.length / 2)]! : null;
}

export interface WorkflowStarter { (workOrder: WorkOrder, incident: Incident): Promise<string | undefined> }
let workflowStarter: WorkflowStarter | undefined;
/** Set by the Lambda entry point when STATE_MACHINE_ARN is configured (A5.7). */
export function setWorkflowStarter(fn: WorkflowStarter | undefined) {
  workflowStarter = fn;
}

export async function issueWorkOrder(store: Store, incidentId: string, body: { actionType?: ActionType; agency?: Agency; demo?: boolean } = {}) {
  const incident = await loadIncident(store, incidentId);
  const now = await eventTime(store, incident, 'issue');
  const recommend = await getRecommender(store, incident.dataset);
  const r = issue(incident, { now, actionType: body.actionType, agency: body.agency, recommend, demo: body.demo, usualPm10: await usualPm10(store, incident) });
  if (workflowStarter && ACTIONS[r.workOrder.actionType].measurable) {
    const executionArn = await workflowStarter(r.workOrder, r.incident);
    if (executionArn) {
      r.workOrder.executionArn = executionArn;
      r.incident.workOrders = r.incident.workOrders.map((w) => (w.id === r.workOrder.id ? r.workOrder : w));
    }
  }
  await store.putIncident(r.incident);
  return r;
}

export async function startWorkOrder(store: Store, workOrderId: string) {
  const { incident, workOrder } = await loadWorkOrder(store, workOrderId);
  const r = start(incident, workOrderId, await eventTime(store, incident, 'start', workOrder));
  await store.putIncident(r.incident);
  return r;
}

export async function finishWorkOrder(store: Store, workOrderId: string, photo?: PhotoCheck) {
  const { incident, workOrder } = await loadWorkOrder(store, workOrderId);
  const r = finish(incident, workOrderId, await eventTime(store, incident, 'done', workOrder), photo);
  await store.putIncident(r.incident);
  return r;
}

/** Collect everything measureEffect needs from the store and measure. Returns null if not measurable yet. */
export async function measureWorkOrder(store: Store, workOrderId: string, opts: { force?: boolean } = {}) {
  const { incident, workOrder } = await loadWorkOrder(store, workOrderId);
  const now = await datasetNow(store, incident.dataset);
  if (workOrder.status !== 'done' || !ACTIONS[workOrder.actionType].measurable) return { incident, workOrder, measured: false };
  if (workOrder.effect && !opts.force) return { incident, workOrder, measured: false };
  if (!afterWindowComplete(workOrder, now)) return { incident, workOrder, measured: false };

  const effect = measureEffect(await buildEffectInput(store, incident, workOrder, now));
  const r = applyEffect(incident, workOrderId, effect, now);
  await store.putIncident(r.incident);
  return { ...r, measured: true };
}


/** Everything measureEffect needs for one work order, from the store. Shared by the API, ingest, workflow and placebo test. */
export async function buildEffectInput(store: Store, incident: Incident, workOrder: WorkOrder, now: string, all?: Incident[]): Promise<EffectInput> {
  const ds = incident.dataset;
  const win = effectWindows(workOrder);
  const from = new Date(win.beforeHours[0]! - H).toISOString();
  const to = new Date(win.afterEnd).toISOString();

  const [readings, weather] = await Promise.all([store.getReadings(ds, incident.stationId, from, to), store.getWeather(ds, from, to)]);
  all ??= await store.listIncidents({ dataset: ds });
  const otherReadings: Record<string, Awaited<ReturnType<Store['getReadings']>>> = {};
  for (const s of STATIONS) if (s.id !== incident.stationId) otherReadings[s.id] = await store.getReadings(ds, s.id, from, to);

  // Stations where another measurable work order was active during either window
  const winStart = new Date(win.beforeHours[0]!).toISOString();
  const inProgressStationIds = [...new Set(all.flatMap((i) => i.workOrders
    .filter((w) => w.id !== workOrder.id && w.status !== 'cancelled' && ACTIONS[w.actionType].measurable)
    .filter((w) => (w.startedAt ?? w.issuedAt) <= to && (w.doneAt ?? to) >= winStart)
    .map(() => i.stationId)))];

  const pool = await poolFor(store, incident, workOrder, all);
  return { workOrder, incident, readings, otherReadings, inProgressStationIds, weather, pool, hotspotStationIds: HOTSPOT_IDS, now };
}

/** Unacted incidents in the same dataset, each with readings around its own equivalent window. */
export async function poolFor(store: Store, incident: Incident, workOrder: WorkOrder, all: Incident[]) {
  const start = Date.parse(incident.start);
  const win = effectWindows(workOrder);
  const before = win.beforeHours[0]! - start - H;
  const after = win.afterEnd - start + H;
  const candidates = all.filter((i) => i.id !== incident.id && isUnacted(i));
  return Promise.all(candidates.map(async (i) => {
    const s = Date.parse(i.start);
    const readings = await store.getReadings(i.dataset, i.stationId, new Date(s + before).toISOString(), new Date(s + after).toISOString());
    return { incident: i, readings };
  }));
}

/** Ingest fallback (A3.6): measure every done work order with no effect whose after window is complete. */
export async function measurePending(store: Store, dataset: Dataset): Promise<string[]> {
  const now = await datasetNow(store, dataset);
  const measured: string[] = [];
  for (const i of await store.listIncidents({ dataset })) {
    for (const w of i.workOrders) {
      if (w.status !== 'done' || w.effect || !ACTIONS[w.actionType].measurable || !afterWindowComplete(w, now)) continue;
      const r = await measureWorkOrder(store, w.id);
      if (r.measured) measured.push(w.id);
    }
  }
  return measured;
}

export { pollutantFor };
