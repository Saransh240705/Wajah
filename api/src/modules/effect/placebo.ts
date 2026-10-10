// Placebo test, master PRD 6.3 and track A A6.3. Fake work orders on unacted spikes, where nothing was done.
import { PLAYBOOKS, config, type Dataset, type Incident, type Verdict, type WorkOrder } from '@wajah/shared';
import type { Store } from '../../store';
import { buildEffectInput } from '../workorders/service';
import { isUnacted, measureEffect } from './measure';

const MIN = 60_000;
const addMin = (iso: string, m: number) => new Date(Date.parse(iso) + m * MIN).toISOString();

export function fakeWorkOrder(incident: Incident): WorkOrder {
  const startedAt = addMin(incident.start, config.placebo.startAfterSpikeMin);
  const step = PLAYBOOKS[incident.topCause].steps[0]!;
  return {
    id: `${incident.id}-placebo`, incidentId: incident.id, stationId: incident.stationId, area: incident.area,
    actionType: step.actionType, agency: step.agency, status: 'done', reason: 'placebo', instructionsEn: '', instructionsHi: '',
    escalationLevel: 0, issuedAt: startedAt, startedAt, doneAt: addMin(startedAt, config.placebo.durationMin),
  };
}

export interface PlaceboResult {
  /** Fakes that received a worked or no_effect verdict. */
  tested: number;
  /** Fakes marked worked: false positives. */
  wronglyWorked: number;
  inconclusive: number;
  rows: { incidentId: string; verdict: Verdict; netChangePct: number; note?: string }[];
}

/** Measure a fake work order on every unacted incident, each left out of its own baseline. Writes nothing. */
export async function runPlacebo(store: Store, dataset: Dataset, now: string): Promise<PlaceboResult> {
  const all = await store.listIncidents({ dataset });
  const rows: PlaceboResult['rows'] = [];
  for (const incident of all.filter(isUnacted)) {
    const wo = fakeWorkOrder(incident);
    const e = measureEffect(await buildEffectInput(store, incident, wo, now, all));
    rows.push({ incidentId: incident.id, verdict: e.verdict, netChangePct: e.netChangePct, ...(e.note ? { note: e.note } : {}) });
  }
  const judged = rows.filter((r) => r.verdict !== 'inconclusive');
  return {
    tested: judged.length,
    wronglyWorked: judged.filter((r) => r.verdict === 'worked').length,
    inconclusive: rows.length - judged.length,
    rows,
  };
}
