import { describe, expect, it } from 'vitest';
import type { Cause, Incident, Reading, Weather, WorkOrder } from '@wajah/shared';
import { measureEffect, type EffectInput } from '../src/modules/effect/measure';

const H = 3600_000;
const at = (iso: string, h: number) => new Date(Date.parse(iso) + h * H).toISOString();
const START = '2026-11-03T10:00:00.000Z';

function incident(id: string, stationId: string, start: string, topCause: Cause = 'local_burning', workOrders: WorkOrder[] = []): Incident {
  return {
    id, dataset: 'replay', stationId, area: stationId, start, end: at(start, 6), peakPm25: 400, peakPm10: 600, peakAt: at(start, 1),
    baselinePm25: 150, features: { pmRatio: 0.7, coRise: 1.5, no2Rise: 1.1, spatialShare: 0.1, windSpeed: 1, windDir: 200, blh: null, upwindFires: 0, hourBand: 'night' },
    scores: { local_burning: 80, dust: 0, traffic: 0, regional_smoke: 0, trapped_air: 0 }, topCause, confidence: 'high', evidence: [],
    status: 'dispatched', recurrenceCount: 0, escalationLevel: 0, workOrders, checks: [], createdAt: start, updatedAt: start,
  };
}

// Work order: issued START+1h, started START+2h (T), done START+3.5h.
// Before window: START+0h, START+1h. After window: START+4h..START+6h.
function workOrder(over: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'inc-w1', incidentId: 'inc', stationId: 's1', area: 's1', actionType: 'anti_burning_patrol', agency: 'MCD', status: 'done',
    reason: '', instructionsEn: '', instructionsHi: '', escalationLevel: 0,
    issuedAt: at(START, 1), startedAt: at(START, 2), doneAt: at(START, 3.5), ...over,
  };
}

/** Hourly readings from `from`, one value per hour (null = missing hour). */
function series(stationId: string, from: string, values: (number | null)[], pollutant: 'pm25' | 'pm10' = 'pm25', other = 999): Reading[] {
  return values.map((v, i) => ({
    stationId, ts: at(from, i),
    pm25: pollutant === 'pm25' ? v : other, pm10: pollutant === 'pm10' ? v : other,
    no2: 40, co: 1.2, so2: null, o3: null, source: 'openaq',
  }));
}

const BEFORE = [400, 400];
const flat = (v: number) => [v, v, v, v, v, v, v];
const weather = (from: string, hours: number, over: Partial<Weather> = {}): Weather[] =>
  Array.from({ length: hours }, (_, i) => ({ ts: at(from, i), windSpeed: 2, windDir: 200, blh: null, precip: 0, ...over }));

/** Unacted incidents at `stationId`, each starting a day apart, whose readings fall 10% at the same offset. */
function pool(n: number, stationId = 's1', pollutant: 'pm25' | 'pm10' = 'pm25', after = 360) {
  return Array.from({ length: n }, (_, k) => {
    const s = at(START, -24 * (k + 1));
    // hours 0..6 from s: before 400,400 at h0,h1; filler; after at h4..h6
    return { incident: incident(`p${stationId}${k}`, stationId, s), readings: series(stationId, s, [400, 400, 380, 370, after, after, after], pollutant) };
  });
}

function input(over: Partial<EffectInput> = {}, after = [280, 280, 280]): EffectInput {
  const target = series('s1', START, [...BEFORE, 390, 380, ...after]);
  return {
    workOrder: workOrder(),
    incident: incident('inc', 's1', START),
    readings: target,
    otherReadings: { s2: series('s2', START, flat(200)), s3: series('s3', START, flat(200)) },
    inProgressStationIds: [],
    weather: weather(START, 8),
    pool: pool(3),
    hotspotStationIds: ['s1', 's2', 's3'],
    now: at(START, 12),
    ...over,
  };
}

describe('measureEffect', () => {
  it('1. clear drop: change -30, expected -10, net -20, worked', () => {
    const r = measureEffect(input());
    expect(r.beforeMean).toBe(400);
    expect(r.afterMean).toBe(280);
    expect(r.changePct).toBe(-30);
    expect(r.expectedChangePct).toBe(-10);
    expect(r.netChangePct).toBe(-20);
    expect(r.verdict).toBe('worked');
  });

  it('2. usual fade: change -12, net -2, no_effect', () => {
    const r = measureEffect(input({}, [352, 352, 352]));
    expect(r.changePct).toBe(-12);
    expect(r.netChangePct).toBe(-2);
    expect(r.verdict).toBe('no_effect');
  });

  it('3. rain: 1 mm in the after window is inconclusive with a note naming rain', () => {
    const w = weather(START, 8).map((x, i) => (i === 5 ? { ...x, precip: 1 } : x));
    const r = measureEffect(input({ weather: w }));
    expect(r.verdict).toBe('inconclusive');
    expect(r.note).toMatch(/rain/i);
  });

  it('4. city-wide shift: other stations fall 30% in the same hours', () => {
    const fall = [200, 200, 180, 160, 140, 140, 140];
    const r = measureEffect(input({ otherReadings: { s2: series('s2', START, fall), s3: series('s3', START, fall) } }));
    expect(r.cityChangePct).toBe(-30);
    expect(r.verdict).toBe('inconclusive');
  });

  it('5. missing data: only one reading in the after window', () => {
    const r = measureEffect(input({}, [280, null as unknown as number, null as unknown as number]));
    expect(r.verdict).toBe('inconclusive');
    expect(r.note).toMatch(/reading/i);
  });

  it('6. no baseline: no unacted incidents anywhere gives expected 0 and "no baseline yet"', () => {
    const r = measureEffect(input({ pool: [] }));
    expect(r.expectedChangePct).toBe(0);
    expect(r.note).toContain('no baseline yet');
    expect(r.netChangePct).toBe(-30);
  });

  it('7. dust: uses PM10 for every mean, including the expected fade and the city change', () => {
    const r = measureEffect(input({
      incident: incident('inc', 's1', START, 'dust'),
      readings: series('s1', START, [...BEFORE, 390, 380, 280, 280, 280], 'pm10', 50),
      otherReadings: { s2: series('s2', START, flat(200), 'pm10', 10), s3: series('s3', START, flat(200), 'pm10', 90) },
      pool: pool(3, 's1', 'pm10'),
    }));
    expect(r.pollutant).toBe('pm10');
    expect(r.beforeMean).toBe(400);
    expect(r.afterMean).toBe(280);
    expect(r.expectedChangePct).toBe(-10);
    expect(r.cityChangePct).toBe(0);
    expect(r.verdict).toBe('worked');
  });

  it('8. never started: uses issuedAt as the reference time', () => {
    // issuedAt START+1h: before window is START-1h..START+0h. Never done: after starts the hour after T.
    const target = series('s1', at(START, -1), [500, 500, 999, 450, 450, 450]);
    const r = measureEffect(input({ workOrder: workOrder({ startedAt: undefined, doneAt: undefined }), readings: target }));
    expect(r.beforeMean).toBe(500);
    expect(r.afterMean).toBe(450);
    expect(r.changePct).toBe(-10);
  });

  // Extra guards on the rules
  it('pool falls back to hotspot stations when this station has fewer than 3', () => {
    const others = [...pool(3, 's2'), ...pool(2, 's3')];
    const r = measureEffect(input({ pool: [...pool(1), ...others] }));
    expect(r.expectedChangePct).toBe(-10);
    expect(r.note ?? '').not.toContain('no baseline yet');
  });

  it('acted incidents and the incident itself are left out of the pool', () => {
    const acted = pool(3).map((p) => ({ ...p, incident: { ...p.incident, workOrders: [workOrder({ id: 'x' })] } }));
    const self = { incident: incident('inc', 's1', START), readings: series('s1', START, [400, 400, 0, 0, 0, 0, 0]) };
    const r = measureEffect(input({ pool: [...acted, self] }));
    expect(r.expectedChangePct).toBe(0);
    expect(r.note).toContain('no baseline yet');
  });

  it('wind doubling between windows is inconclusive', () => {
    const w = weather(START, 8).map((x, i) => (i >= 4 ? { ...x, windSpeed: 4 } : x));
    expect(measureEffect(input({ weather: w })).verdict).toBe('inconclusive');
  });

  it('stations with a work order in progress are left out of the city change', () => {
    const fall = [200, 200, 180, 160, 140, 140, 140];
    const r = measureEffect(input({ otherReadings: { s2: series('s2', START, fall), s3: series('s3', START, flat(200)) }, inProgressStationIds: ['s2'] }));
    expect(r.cityChangePct).toBe(0);
  });
});
