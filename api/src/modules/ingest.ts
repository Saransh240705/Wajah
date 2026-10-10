// Hourly ingest, track A A1.6 / A2.5 / A3.6. Safe to run twice: every write is an upsert.
import { config, type Dataset, type Fire } from '@wajah/shared';
import { datasetNow } from '../lib/clock';
import { STATIONS } from '../lib/stations';
import type { Store } from '../store';
import { runDetection } from './fingerprint/diagnose';
import { getFireFetcher, getReadingSource, weatherFetcher, type FireFetcher, type ReadingSource, type WeatherFetcher } from './sources';
import { measurePending } from './workorders/service';

const H = 3600_000;
const log = (o: Record<string, unknown>) => console.log(JSON.stringify(o));

export interface IngestDeps {
  source?: ReadingSource | null;
  weather?: WeatherFetcher | null;
  fires?: FireFetcher | null;
  now?: string;
}

export interface IngestSummary {
  readings: number;
  weather: number;
  fires: number;
  created: string[];
  updated: string[];
  measured: string[];
  errors: string[];
}

export function groupFiresByDay(fires: Fire[]): Map<string, Fire[]> {
  const m = new Map<string, Fire[]>();
  for (const f of fires) {
    const day = f.acquiredAt.slice(0, 10);
    m.set(day, [...(m.get(day) ?? []), f]);
  }
  return m;
}

export async function runIngest(store: Store, dataset: Dataset = 'live', deps: IngestDeps = {}): Promise<IngestSummary> {
  const now = deps.now ?? (await datasetNow(store, dataset));
  const out: IngestSummary = { readings: 0, weather: 0, fires: 0, created: [], updated: [], measured: [], errors: [] };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      out.errors.push(`${name}: ${(e as Error).message}`);
      log({ level: 'error', step: name, message: (e as Error).message });
    }
  };

  const source = deps.source === undefined ? await getReadingSource() : deps.source;
  await step('readings', async () => {
    if (!source) throw new Error(`no readings source configured (READINGS_SOURCE=${process.env.READINGS_SOURCE ?? 'openaq'}, key missing?)`);
    const rows = await source.fetchLatest(STATIONS);
    await store.putReadings(dataset, rows);
    out.readings = rows.length;
    for (const s of STATIONS) {
      const mine = rows.filter((r) => r.stationId === s.id);
      const last = mine.reduce<string | null>((a, r) => (!a || r.ts > a ? r.ts : a), null);
      log({ step: 'readings', station: s.id, source: source.name, rows: mine.length, latest: last });
    }
  });

  const weather = deps.weather === undefined ? weatherFetcher : deps.weather;
  await step('weather', async () => {
    if (!weather) return;
    const rows = await weather(new Date(Date.parse(now) - config.detect.ingestLookbackHours * H).toISOString(), now);
    await store.putWeather(dataset, rows);
    out.weather = rows.length;
  });

  const fires = deps.fires === undefined ? await getFireFetcher() : deps.fires;
  await step('fires', async () => {
    if (!fires) throw new Error('no fire source configured (FIRMS_MAP_KEY missing?)');
    const rows = await fires(Math.ceil(config.features.fireLookbackHours / 24));
    for (const [day, list] of groupFiresByDay(rows)) await store.putFires(dataset, day, list);
    out.fires = rows.length;
  });

  await step('detect', async () => {
    const r = await runDetection(store, dataset, { now });
    out.created = r.created;
    out.updated = r.updated;
    if (!r.created.length && !r.updated.length) {
      log({ step: 'detect', message: '0 incidents', maxPm25: Object.fromEntries(r.perStation.map((p) => [p.stationId, p.maxPm25])) });
    } else {
      log({ step: 'detect', created: r.created, updated: r.updated });
    }
  });

  // A3.6 fallback: measure any done work order whose after window is complete
  await step('measure', async () => {
    out.measured = await measurePending(store, dataset);
    if (out.measured.length) log({ step: 'measure', measured: out.measured });
  });

  log({ step: 'ingest', dataset, now, readings: out.readings, weather: out.weather, fires: out.fires, created: out.created.length, measured: out.measured.length, errors: out.errors.length });
  return out;
}
