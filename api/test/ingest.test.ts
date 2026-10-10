import { describe, expect, it, vi } from 'vitest';
import type { Reading, Station, Weather } from '@wajah/shared';
import { runIngest } from '../src/modules/ingest';
import type { ReadingSource } from '../src/modules/sources';
import { MemoryStore } from '../src/store/memory';
import { STATIONS } from '../src/lib/stations';

const H = 3600_000;
const NOW = '2026-11-09T21:00:00.000Z';
const at = (h: number) => new Date(Date.parse(NOW) + h * H).toISOString();

// Last 9 days hourly; Anand Vihar spikes 17:00-20:00 UTC on the last evening
const fakeSource: ReadingSource = {
  name: 'openaq',
  async fetchLatest(stations: Station[]) {
    const rows: Reading[] = [];
    for (let h = -9 * 24; h < 0; h++) {
      for (const s of stations) {
        const spike = s.id === 'anand-vihar' && h >= -4 && h <= -2 ? 300 : undefined;
        rows.push({ stationId: s.id, ts: at(h), pm25: spike ?? 100, pm10: spike ? 420 : 200, no2: 40, co: spike ? 1.6 : 1, so2: null, o3: null, source: 'openaq' });
      }
    }
    return rows;
  },
};
const fakeWeather = async (from: string, to: string): Promise<Weather[]> => {
  const out: Weather[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += H) out.push({ ts: new Date(t).toISOString(), windSpeed: 1, windDir: 150, blh: 250, precip: 0 });
  return out;
};

describe('A1.6 runIngest', () => {
  it('writes readings, weather and fires, then detects; running it twice leaves the same row counts', async () => {
    const store = new MemoryStore({ seed: 'none' });
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((m: string) => void logs.push(m));
    const deps = { source: fakeSource, weather: fakeWeather, fires: async () => [], now: NOW };
    const first = await runIngest(store, 'replay', deps);
    const count = async () => (await Promise.all(STATIONS.map((s) => store.getReadings('replay', s.id, at(-10 * 24), NOW)))).flat().length;
    const rows1 = await count();
    const incidents1 = (await store.listIncidents({ dataset: 'replay' })).length;
    const second = await runIngest(store, 'replay', deps);
    spy.mockRestore();

    expect(first.errors).toEqual([]);
    expect(first.created).toHaveLength(1);
    expect(second.created).toHaveLength(0);
    expect(await count()).toBe(rows1);
    expect((await store.listIncidents({ dataset: 'replay' })).length).toBe(incidents1);
    // one log line per station per run
    expect(logs.filter((l) => l.includes('"step":"readings"')).length).toBe(2 * STATIONS.length);
  });

  it('one failing source does not stop the rest', async () => {
    const store = new MemoryStore({ seed: 'none' });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await runIngest(store, 'replay', { source: null, weather: fakeWeather, fires: null, now: NOW });
    spy.mockRestore();
    expect(r.errors.map((e) => e.split(':')[0])).toEqual(['readings', 'fires']);
    expect(r.weather).toBeGreaterThan(0);
  });
});
