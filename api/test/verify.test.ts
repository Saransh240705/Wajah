import { describe, expect, it } from 'vitest';
import type { Cause, EffectResult, Incident, IncidentStatus, Reading, Verdict, WorkOrder } from '@wajah/shared';
import { checkRecurrence } from '../src/modules/verify/recurrence';

const H = 3600_000;
const D = 24 * H;
const at = (iso: string, h: number) => new Date(Date.parse(iso) + h * H).toISOString();
const START = '2026-11-03T16:00:00.000Z'; // 21:30 India time

function effect(verdict: Verdict): EffectResult {
  return { pollutant: 'pm25', beforeMean: 300, afterMean: 200, changePct: -33, expectedChangePct: -10, cityChangePct: 0, netChangePct: -23, verdict, measuredAt: START };
}
function wo(verdict?: Verdict): WorkOrder {
  return {
    id: 'inc-w1', incidentId: 'inc', stationId: 's1', area: 's1', actionType: 'anti_burning_patrol', agency: 'MCD', status: 'done', reason: '',
    instructionsEn: '', instructionsHi: '', escalationLevel: 0, issuedAt: at(START, 1), doneAt: at(START, 2), ...(verdict ? { effect: effect(verdict) } : {}),
  };
}
function incident(id: string, start: string, status: IncidentStatus = 'dispatched', workOrders: WorkOrder[] = [], topCause: Cause = 'local_burning'): Incident {
  return {
    id, dataset: 'replay', stationId: 's1', area: 's1', start, end: at(start, 3), peakPm25: 300, peakPm10: 400, peakAt: at(start, 1), baselinePm25: 100,
    features: { pmRatio: 0.7, coRise: 1.5, no2Rise: 1, spatialShare: 0.1, windSpeed: 1, windDir: 180, blh: null, upwindFires: 2, hourBand: 'night' },
    scores: { local_burning: 90, dust: 0, traffic: 0, regional_smoke: 0, trapped_air: 0 }, topCause, confidence: 'high', evidence: [],
    status, recurrenceCount: 0, escalationLevel: 0, workOrders, checks: [], createdAt: start, updatedAt: start,
  };
}
/** Hourly readings for `days` days after START at 120, so later nights have data. */
const readings = (days: number): Reading[] => Array.from({ length: days * 24 + 8 }, (_, h) => ({
  stationId: 's1', ts: at(START, h), pm25: 120 + (h % 24 === 1 ? 20 : 0), pm10: 200, no2: 30, co: 1, so2: null, o3: null, source: 'openaq',
}));

describe('checkRecurrence', () => {
  it('worked + two clean nights: cleared, with both checks stored', () => {
    const r = checkRecurrence({ incident: incident('inc', START, 'dispatched', [wo('worked')]), later: [], readings: readings(3), now: at(START, 2 * 24 + 6) });
    expect(r.status).toBe('cleared');
    expect(r.checks.map((c) => c.result)).toEqual(['clean', 'clean']);
    expect(r.checks[0]).toMatchObject({ date: '2026-11-04', peakPm25: 140 });
  });

  it('no_effect + two clean nights: not cleared, stays recurred', () => {
    const r = checkRecurrence({ incident: incident('inc', START, 'recurred', [wo('no_effect')]), later: [], readings: readings(3), now: at(START, 2 * 24 + 6) });
    expect(r.status).toBe('recurred');
    expect(r.checks).toHaveLength(2);
  });

  it('a later incident with the same cause in the window: recurred, recurrenceCount + 1', () => {
    const again = incident('inc2', at(START, 24 + 1), 'open');
    const r = checkRecurrence({ incident: incident('inc', START, 'dispatched', [wo('worked')]), later: [again], readings: readings(2), now: at(START, 24 + 6) });
    expect(r.status).toBe('recurred');
    expect(r.recurrenceCount).toBe(1);
    expect(r.checks).toEqual([{ date: '2026-11-04', result: 'recurred', peakPm25: 140 }]);
  });

  it('a later incident with a different cause does not count', () => {
    const other = incident('inc2', at(START, 24 + 1), 'open', [], 'dust');
    const r = checkRecurrence({ incident: incident('inc', START, 'dispatched', [wo('worked')]), later: [other], readings: readings(2), now: at(START, 24 + 6) });
    expect(r.checks[0]!.result).toBe('clean');
  });

  it('nights whose window has not passed are not checked, and checks are not repeated', () => {
    const inc = incident('inc', START, 'dispatched', [wo('worked')]);
    expect(checkRecurrence({ incident: inc, later: [], readings: readings(1), now: at(START, 20) }).checks).toEqual([]);
    const once = checkRecurrence({ incident: inc, later: [], readings: readings(1), now: at(START, 24 + 6) });
    const twice = checkRecurrence({ incident: once, later: [], readings: readings(1), now: at(START, 24 + 6) });
    expect(twice.checks).toHaveLength(1);
  });

  it('an incident with no work order is never cleared', () => {
    const r = checkRecurrence({ incident: incident('inc', START, 'open'), later: [], readings: readings(3), now: at(START, 3 * 24 + 6) });
    expect(r.status).toBe('open');
  });

  it('a night with no readings is skipped, not counted as clean', () => {
    const r = checkRecurrence({ incident: incident('inc', START, 'dispatched', [wo('worked')]), later: [], readings: [], now: at(START, 3 * 24 + 6) });
    expect(r.checks).toEqual([]);
    expect(r.status).toBe('dispatched');
  });

  void D;
});
