import type { Dataset } from '@wajah/shared';
import { datasetNow } from '../../lib/clock';
import type { Store } from '../../store';
import { checkRecurrence } from './recurrence';

const D = 24 * 3600_000;
const LOOKBACK_DAYS = 14; // matches the ledger and scoreboard default period

export async function verifyIncident(store: Store, id: string) {
  const incident = await store.getIncident(id);
  if (!incident) return null;
  const now = await datasetNow(store, incident.dataset);
  const [later, readings] = await Promise.all([
    store.listIncidents({ dataset: incident.dataset, stationId: incident.stationId, sinceIso: incident.start }),
    store.getReadings(incident.dataset, incident.stationId, incident.start, now),
  ]);
  const updated = checkRecurrence({ incident, later: later.filter((i) => i.start > incident.start), readings, now });
  if (JSON.stringify(updated) !== JSON.stringify(incident)) await store.putIncident(updated);
  return updated;
}

/** Daily job: re-check every incident from the last two weeks that is not cleared. */
export async function verifyAll(store: Store, dataset: Dataset) {
  const now = await datasetNow(store, dataset);
  const since = new Date(Date.parse(now) - LOOKBACK_DAYS * D).toISOString();
  const list = (await store.listIncidents({ dataset, sinceIso: since })).filter((i) => i.status !== 'cleared');
  const changed: string[] = [];
  for (const i of list) {
    const u = await verifyIncident(store, i.id);
    if (u && (u.status !== i.status || u.checks.length !== i.checks.length)) changed.push(`${u.id}:${u.status}`);
  }
  return changed;
}
