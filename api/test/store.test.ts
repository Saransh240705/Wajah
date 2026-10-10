import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Fire, Incident, Reading, Weather } from '@wajah/shared';
import { MemoryStore } from '../src/store/memory';
import type { Store } from '../src/store/types';

const reading = (stationId: string, ts: string, pm25: number): Reading =>
  ({ stationId, ts, pm25, pm10: pm25 * 2, no2: 30, co: 1, so2: null, o3: null, source: 'openaq' });
const weather = (ts: string): Weather => ({ ts, windSpeed: 2.5, windDir: 300, blh: 400, precip: 0.1 });
const fire = (acquiredAt: string): Fire => ({ lat: 30.5, lon: 75.5, acquiredAt, frp: 12.3, confidence: 'n' });
const incident = (id: string, stationId: string, start: string, end: string | null = null): Incident => ({
  id, dataset: 'replay', stationId, area: stationId, start, end, peakPm25: 300, peakPm10: 450, peakAt: start, baselinePm25: 100,
  features: { pmRatio: 0.7, coRise: 1.5, no2Rise: 1, spatialShare: 0.2, windSpeed: 1, windDir: 180, blh: null, upwindFires: 3, hourBand: 'night' },
  scores: { local_burning: 90, dust: 0, traffic: 10, regional_smoke: 0, trapped_air: 30 }, topCause: 'local_burning', confidence: 'high', evidence: [],
  status: 'open', recurrenceCount: 0, escalationLevel: 0, workOrders: [], checks: [], createdAt: start, updatedAt: start,
});

/** Contract tests any Store must pass (reused for DynamoStore with STORE=dynamo). */
export function storeContract(name: string, make: () => Store | Promise<Store>) {
  describe(`${name} contract`, () => {
    it('readings round-trip, filtered by dataset, station and time, sorted by ts', async () => {
      const s = await make();
      await s.putReadings('replay', [reading('a', '2026-11-01T02:00:00Z', 120), reading('a', '2026-11-01T01:00:00Z', 110), reading('b', '2026-11-01T01:00:00Z', 90)]);
      await s.putReadings('live', [reading('a', '2026-11-01T01:00:00Z', 999)]);
      const got = await s.getReadings('replay', 'a', '2026-11-01T00:00:00Z', '2026-11-01T02:00:00Z');
      expect(got.map((r) => r.pm25)).toEqual([110, 120]);
      expect(got[0]).toEqual(reading('a', '2026-11-01T01:00:00.000Z', 110));
    });

    it('putting the same rows twice keeps the same count, and the latest is one per station', async () => {
      const s = await make();
      const rows = [reading('a', '2026-11-01T01:00:00Z', 110), reading('a', '2026-11-01T02:00:00Z', 120), reading('b', '2026-11-01T01:00:00Z', 90)];
      await s.putReadings('replay', rows);
      await s.putReadings('replay', rows);
      expect(await s.getReadings('replay', 'a', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toHaveLength(2);
      const latest = await s.getLatestReadings('replay');
      expect(latest.map((r) => `${r.stationId}:${r.pm25}`).sort()).toEqual(['a:120', 'b:90']);
    });

    it('weather round-trips', async () => {
      const s = await make();
      await s.putWeather('replay', [weather('2026-11-01T01:00:00Z'), weather('2026-11-01T02:00:00Z')]);
      const got = await s.getWeather('replay', '2026-11-01T01:30:00Z', '2026-11-01T03:00:00Z');
      expect(got).toEqual([weather('2026-11-01T02:00:00.000Z')]);
    });

    it('fires round-trip by day, and a re-put replaces that day', async () => {
      const s = await make();
      await s.putFires('replay', '2026-11-01', [fire('2026-11-01T05:30:00.000Z'), fire('2026-11-01T20:10:00.000Z')]);
      await s.putFires('replay', '2026-11-02', [fire('2026-11-02T05:30:00.000Z')]);
      expect(await s.getFires('replay', '2026-11-01T00:00:00Z', '2026-11-01T23:59:59Z')).toHaveLength(2);
      await s.putFires('replay', '2026-11-01', [fire('2026-11-01T05:30:00.000Z')]);
      expect(await s.getFires('replay', '2026-11-01T00:00:00Z', '2026-11-03T00:00:00Z')).toHaveLength(2);
    });

    it('incidents round-trip and list with filters, newest first', async () => {
      const s = await make();
      const a = incident('replay-a-1', 'a', '2026-11-01T01:00:00.000Z', '2026-11-01T04:00:00.000Z');
      const b = { ...incident('replay-b-1', 'b', '2026-11-02T01:00:00.000Z'), status: 'dispatched' as const };
      await s.putIncident(a);
      await s.putIncident(b);
      expect(await s.getIncident('replay-a-1')).toEqual(a);
      expect(await s.getIncident('nope')).toBeNull();
      expect((await s.listIncidents({ dataset: 'replay' })).map((i) => i.id)).toEqual(['replay-b-1', 'replay-a-1']);
      expect((await s.listIncidents({ dataset: 'replay', stationId: 'a' })).map((i) => i.id)).toEqual(['replay-a-1']);
      expect((await s.listIncidents({ dataset: 'replay', status: 'dispatched' })).map((i) => i.id)).toEqual(['replay-b-1']);
      expect((await s.listIncidents({ dataset: 'replay', sinceIso: '2026-11-01T12:00:00Z' })).map((i) => i.id)).toEqual(['replay-b-1']);
      expect(await s.listIncidents({ dataset: 'live' })).toEqual([]);
    });

    it('stored incidents are copies: mutating a result does not change the store', async () => {
      const s = await make();
      await s.putIncident(incident('replay-c-1', 'c', '2026-11-01T01:00:00.000Z'));
      const got = (await s.getIncident('replay-c-1'))!;
      got.status = 'cleared';
      expect((await s.getIncident('replay-c-1'))!.status).toBe('open');
    });
  });
}

storeContract('MemoryStore', () => new MemoryStore({ seed: 'none' }));

describe('MemoryStore persistence', () => {
  it('STORE_FILE survives a restart', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'wajah-')), 'store.json');
    const a = new MemoryStore({ file, seed: 'none' });
    await a.putReadings('live', [reading('a', '2026-11-01T01:00:00Z', 110)]);
    await a.putIncident(incident('replay-a-1', 'a', '2026-11-01T01:00:00.000Z'));
    const b = new MemoryStore({ file });
    expect(await b.getReadings('live', 'a', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z')).toHaveLength(1);
    expect(await b.getIncident('replay-a-1')).not.toBeNull();
  });

  it('seeds from the mock fixtures', async () => {
    const s = new MemoryStore({ seed: 'fixtures' });
    expect((await s.listIncidents({ dataset: 'live' })).length).toBeGreaterThanOrEqual(6);
    expect((await s.getLatestReadings('live')).length).toBeGreaterThanOrEqual(12);
  });
});

// A5.1: the same contract against real tables. Runs only with STORE=dynamo and the stack's table names set.
if (process.env.STORE === 'dynamo') {
  const { DynamoStore } = await import('../src/store/dynamo');
  const run = `t${Date.now()}`;
  // Use a unique dataset-free prefix by station id so test rows never collide with real ones
  storeContract('DynamoStore', () => {
    const s = new DynamoStore();
    const wrap = (id: string) => `${run}-${id}`;
    return {
      ...s,
      putReadings: (ds, rows) => s.putReadings(ds, rows.map((r) => ({ ...r, stationId: wrap(r.stationId) }))),
      getReadings: async (ds, id, f, t) => (await s.getReadings(ds, wrap(id), f, t)).map((r) => ({ ...r, stationId: r.stationId.slice(run.length + 1) })),
      getLatestReadings: async () => [],
      putWeather: (ds, rows) => s.putWeather(ds, rows),
      getWeather: (ds, f, t) => s.getWeather(ds, f, t),
      putFires: (ds, d, rows) => s.putFires(ds, d, rows),
      getFires: (ds, f, t) => s.getFires(ds, f, t),
      putIncident: (i) => s.putIncident({ ...i, id: wrap(i.id) }),
      getIncident: async (id) => {
        const i = await s.getIncident(wrap(id));
        return i ? { ...i, id: i.id.slice(run.length + 1) } : null;
      },
      listIncidents: async (f) => (await s.listIncidents(f)).filter((i) => i.id.startsWith(run)).map((i) => ({ ...i, id: i.id.slice(run.length + 1) })),
    } as Store;
  });
}
