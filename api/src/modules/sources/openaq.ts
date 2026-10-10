// OpenAQ v3 adapter. Written against shared/fixtures/raw/openaq-locations-delhi.json, openaq-latest-anand-vihar.json
// and openaq-hours-anand-vihar-pm25*.json. Paths and parameters checked against https://api.openaq.org/openapi.json.
import type { Reading, Station } from '@wajah/shared';
import { fetchWithTimeout, hourIso, sleep } from './http';
import type { ReadingSource } from './types';

const BASE = 'https://api.openaq.org/v3';
const SPACING_MS = 1100;      // stay under 60 requests a minute
const PAGE_LIMIT = 1000;
const MAX_RETRIES = 5;

type Pollutant = 'pm25' | 'pm10' | 'no2' | 'co' | 'so2' | 'o3';
const POLLUTANTS: Pollutant[] = ['pm25', 'pm10', 'no2', 'co', 'so2', 'o3'];
const isPollutant = (p: string): p is Pollutant => (POLLUTANTS as string[]).includes(p);

interface Dt { utc: string; local: string }
export interface LocationsBody { results: { id: number; name: string; sensors: { id: number; parameter: { name: string; units: string } }[] }[] }
export interface LatestBody { results: { datetime: Dt; value: number; sensorsId: number; locationsId: number }[] }
export interface HoursBody { meta: { found: number | string }; results: { value: number | null; period: { datetimeFrom: Dt } }[] }

/** sensorId -> pollutant for every sensor of every location in a locations response. */
export function sensorParameters(body: LocationsBody): Map<number, Pollutant> {
  const m = new Map<number, Pollutant>();
  for (const l of body.results) for (const s of l.sensors) if (isPollutant(s.parameter.name)) m.set(s.id, s.parameter.name);
  return m;
}

/** For one location's latest rows: each pollutant's sensors, newest reading first (old sensors linger for years). */
export function sensorsByRecency(latest: LatestBody, params: Map<number, Pollutant>): Map<Pollutant, { sensorId: number; utc: string; value: number }[]> {
  const out = new Map<Pollutant, { sensorId: number; utc: string; value: number }[]>();
  for (const r of latest.results) {
    const p = params.get(r.sensorsId);
    if (!p) continue;
    out.set(p, [...(out.get(p) ?? []), { sensorId: r.sensorsId, utc: r.datetime.utc, value: r.value }]);
  }
  for (const list of out.values()) list.sort((a, b) => b.utc.localeCompare(a.utc));
  return out;
}

/** Hourly rows as { ts at the start of the UTC hour, value }. Negative values are treated as missing. */
export function parseHours(body: HoursBody): { ts: string; value: number | null }[] {
  return body.results.map((r) => ({
    ts: hourIso(Date.parse(r.period.datetimeFrom.utc)),
    value: r.value != null && r.value >= 0 ? r.value : null,
  }));
}

const emptyReading = (stationId: string, ts: string): Reading =>
  ({ stationId, ts, pm25: null, pm10: null, no2: null, co: null, so2: null, o3: null, source: 'openaq' });

export class OpenAQ implements ReadingSource {
  readonly name = 'openaq' as const;
  private last = 0;
  private params?: Map<number, Pollutant>;
  private sensors = new Map<number, Map<Pollutant, { sensorId: number; utc: string; value: number }[]>>();

  constructor(private readonly key = process.env.OPENAQ_API_KEY ?? '', private readonly log = (m: string) => console.log(m)) {
    if (!key) throw new Error('OPENAQ_API_KEY is not set');
  }

  private async get<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = this.last + SPACING_MS - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      try {
        const res = await fetchWithTimeout(`${BASE}${path}`, { headers: { 'X-API-Key': this.key } }, 'OpenAQ');
        return (await res.json()) as T;
      } catch (e) {
        const status = (e as { status?: number }).status;
        if ((status === 429 || status === 503 || status === undefined) && attempt < MAX_RETRIES) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw e;
      }
    }
  }

  private async sensorParams(stations: Station[]) {
    if (this.params) return this.params;
    const lats = stations.map((s) => s.lat), lons = stations.map((s) => s.lon);
    const pad = 0.05;
    const bbox = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad].map((v) => v.toFixed(4)).join(',');
    this.params = sensorParameters(await this.get<LocationsBody>(`/locations?bbox=${bbox}&limit=${PAGE_LIMIT}`));
    return this.params;
  }

  private async sensorsFor(station: Station, stations: Station[]) {
    const id = station.openaqLocationId!;
    if (!this.sensors.has(id)) {
      const params = await this.sensorParams(stations);
      this.sensors.set(id, sensorsByRecency(await this.get<LatestBody>(`/locations/${id}/latest?limit=${PAGE_LIMIT}`), params));
    }
    return this.sensors.get(id)!;
  }

  /** The newest value per pollutant, at its own hour. Stations without a location id are skipped. */
  async fetchLatest(stations: Station[]): Promise<Reading[]> {
    const out: Reading[] = [];
    for (const s of stations.filter((x) => x.openaqLocationId)) {
      try {
        this.sensors.delete(s.openaqLocationId!); // always fresh for latest
        const by = await this.sensorsFor(s, stations);
        const rows = new Map<string, Reading>();
        for (const [p, list] of by) {
          const top = list[0]!;
          const ts = hourIso(Date.parse(top.utc));
          const r = rows.get(ts) ?? emptyReading(s.id, ts);
          r[p] = top.value >= 0 ? top.value : null;
          rows.set(ts, r);
        }
        out.push(...rows.values());
      } catch (e) {
        this.log(JSON.stringify({ level: 'error', source: 'openaq', station: s.id, message: (e as Error).message }));
      }
    }
    return out;
  }

  /** Hourly history from each pollutant's sensors, newest sensor first, falling back if it has no rows. */
  async fetchHistory(station: Station, fromIso: string, toIso: string, stations: Station[] = [station]): Promise<Reading[]> {
    if (!station.openaqLocationId) return [];
    const by = await this.sensorsFor(station, stations);
    const rows = new Map<string, Reading>();
    for (const p of POLLUTANTS) {
      for (const sensor of by.get(p) ?? []) {
        const got: { ts: string; value: number | null }[] = [];
        for (let page = 1; ; page++) {
          const body = await this.get<HoursBody>(`/sensors/${sensor.sensorId}/hours?datetime_from=${fromIso}&datetime_to=${toIso}&limit=${PAGE_LIMIT}&page=${page}`);
          got.push(...parseHours(body));
          if (body.results.length < PAGE_LIMIT) break;
        }
        if (!got.length) continue; // older sensor may hold this period
        for (const g of got) {
          const r = rows.get(g.ts) ?? emptyReading(station.id, g.ts);
          r[p] = g.value;
          rows.set(g.ts, r);
        }
        break;
      }
    }
    return [...rows.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  }
}

export const openaqSource: ReadingSource | null = process.env.OPENAQ_API_KEY ? new OpenAQ() : null;
