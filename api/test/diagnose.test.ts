import { describe, expect, it } from 'vitest';
import type { Incident, Reading, Weather } from '@wajah/shared';
import { diagnoseRange, runDetection } from '../src/modules/fingerprint/diagnose';
import { STATIONS, stationById } from '../src/lib/stations';
import { MemoryStore } from '../src/store/memory';

const H = 3600_000;
const T0 = Date.parse('2026-11-01T00:00:00.000Z');
const at = (h: number) => new Date(T0 + h * H).toISOString();
const HOURS = 9 * 24;
// Anand Vihar: night bonfire on the last night, 22:30-01:30 IST = 17:00-20:00 UTC, CO up, fine particles
const SPIKE = new Map([[8 * 24 + 17, 260], [8 * 24 + 18, 310], [8 * 24 + 19, 240]]);

function seed(): MemoryStore {
  const s = new MemoryStore({ seed: 'none' });
  const rows: Reading[] = [];
  const weather: Weather[] = [];
  for (let h = 0; h < HOURS; h++) {
    weather.push({ ts: at(h), windSpeed: 1.0, windDir: 150, blh: 250, precip: 0 });
    for (const st of STATIONS) {
      const spike = st.id === 'anand-vihar' ? SPIKE.get(h) : undefined;
      rows.push({ stationId: st.id, ts: at(h), pm25: spike ?? 100, pm10: spike ? Math.round(spike / 0.72) : 200, no2: 40, co: spike ? 1.7 : 1.0, so2: null, o3: null, source: 'openaq' });
    }
  }
  void s.putReadings('replay', rows);
  void s.putWeather('replay', weather);
  return s;
}

const isIncident = (i: Incident) =>
  ['id', 'dataset', 'stationId', 'area', 'start', 'end', 'peakPm25', 'peakPm10', 'peakAt', 'baselinePm25', 'features', 'scores', 'topCause',
    'confidence', 'evidence', 'status', 'recurrenceCount', 'escalationLevel', 'workOrders', 'checks', 'createdAt', 'updatedAt'].every((k) => k in i);

describe('A2.4 runDetection', () => {
  it('creates a complete, diagnosed incident from store data', async () => {
    const store = seed();
    const now = at(HOURS);
    const r = await runDetection(store, 'replay', { now });
    expect(r.created).toEqual(['replay-anand-vihar-2026110917']);
    const inc = (await store.getIncident('replay-anand-vihar-2026110917'))!;
    expect(isIncident(inc)).toBe(true);
    expect(inc).toMatchObject({ start: at(8 * 24 + 17), end: at(8 * 24 + 20), peakPm25: 310, baselinePm25: 100, topCause: 'local_burning', status: 'open' });
    expect(inc.features.hourBand).toBe('night');
    expect(inc.features.coRise).toBe(1.7);
    expect(inc.evidence.find((c) => c.key === 'few_areas')?.label).toBe(`Only 1 of ${STATIONS.length} areas spiked`);
    expect(['medium', 'high']).toContain(inc.confidence);
  });

  it('is safe to run twice and keeps lifecycle state', async () => {
    const store = seed();
    const now = at(HOURS);
    await runDetection(store, 'replay', { now });
    const inc = (await store.getIncident('replay-anand-vihar-2026110917'))!;
    await store.putIncident({ ...inc, status: 'dispatched', recurrenceCount: 2, workOrders: [{ id: `${inc.id}-w1` } as Incident['workOrders'][number]] });
    const again = await runDetection(store, 'replay', { now: at(HOURS + 1) });
    expect(again.created).toEqual([]);
    expect((await store.listIncidents({ dataset: 'replay' }))).toHaveLength(1);
    const kept = (await store.getIncident(inc.id))!;
    expect(kept.status).toBe('dispatched');
    expect(kept.recurrenceCount).toBe(2);
    expect(kept.workOrders).toHaveLength(1);
  });

  it('reports the max PM2.5 per station when nothing spikes', async () => {
    const store = new MemoryStore({ seed: 'none' });
    await store.putReadings('replay', [{ stationId: 'rohini', ts: at(0), pm25: 80, pm10: 150, no2: 30, co: 1, so2: null, o3: null, source: 'openaq' }]);
    const r = await runDetection(store, 'replay', { now: at(1), fromIso: at(0) });
    expect(r.created).toEqual([]);
    expect(r.perStation.find((p) => p.stationId === 'rohini')).toMatchObject({ incidents: 0, maxPm25: 80 });
  });

  it('diagnoseRange diagnoses an arbitrary window', async () => {
    const store = seed();
    const d = await diagnoseRange(store, 'replay', stationById('anand-vihar')!, at(8 * 24 + 17), at(8 * 24 + 20));
    expect(d?.topCause).toBe('local_burning');
    expect(d?.peakPm25).toBe(310);
  });
});
