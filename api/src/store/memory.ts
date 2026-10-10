import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dataset, Fire, Incident, Reading, Weather } from '@wajah/shared';
import { iso, matchIncident, newestFirst, type IncidentFilter, type Store, type StoreDump } from './types';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'shared', 'fixtures');
export const SNAPSHOT_FILE = join(FIXTURES_DIR, 'snapshot.json');

export interface MemoryStoreOptions {
  /** Persist every write to this JSON file, and load from it at start if it exists. */
  file?: string;
  /** Without a file: load the real-data snapshot if present, else the mock fixtures. Ignored when `file` is set. */
  seed?: 'auto' | 'fixtures' | 'none';
}

const DATASETS: Dataset[] = ['live', 'replay'];

export class MemoryStore implements Store {
  private readings = new Map<string, Map<string, Reading>>();   // `${dataset}#${stationId}` -> ts -> row
  private weather = new Map<Dataset, Map<string, Weather>>();
  private fires = new Map<Dataset, Map<string, Fire[]>>();       // dataset -> date -> rows
  private incidents = new Map<string, Incident>();
  private readonly file?: string;

  constructor(opts: MemoryStoreOptions = {}) {
    this.file = opts.file;
    // A file-backed store holds real data: it starts empty when the file is new, never from mock fixtures.
    if (this.file && existsSync(this.file)) this.load(JSON.parse(readFileSync(this.file, 'utf8')));
    else if (!this.file && opts.seed !== 'none') this.seed(opts.seed ?? 'auto');
  }

  private seed(mode: 'auto' | 'fixtures') {
    if (mode === 'auto' && existsSync(SNAPSHOT_FILE)) {
      this.load(JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8')));
      return;
    }
    const read = <T>(name: string): T | null => {
      const p = join(FIXTURES_DIR, name);
      return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
    };
    const rohini = read<{ readings: Reading[]; weather: Weather[]; incidents: Incident[] }>('readings-rohini.json');
    const stations = read<{ latest: Reading | null }[]>('stations.json') ?? [];
    this.putSync('live', [...(rohini?.readings ?? []), ...stations.flatMap((s) => (s.latest ? [s.latest] : []))]);
    for (const w of rohini?.weather ?? []) this.weatherOf('live').set(iso(w.ts), { ...w, ts: iso(w.ts) });
    for (const f of read<Fire[]>('fires.json') ?? []) {
      const day = f.acquiredAt.slice(0, 10);
      const m = this.firesOf('live');
      m.set(day, [...(m.get(day) ?? []), f]);
    }
    for (const i of [...(read<Incident[]>('incidents.json') ?? []), ...(rohini?.incidents ?? [])]) this.incidents.set(i.id, i);
  }

  private load(d: StoreDump) {
    for (const ds of DATASETS) {
      this.putSync(ds, d.readings[ds] ?? []);
      for (const w of d.weather[ds] ?? []) this.weatherOf(ds).set(iso(w.ts), w);
      for (const [day, rows] of Object.entries(d.fires[ds] ?? {})) this.firesOf(ds).set(day, rows);
    }
    for (const i of d.incidents) this.incidents.set(i.id, i);
  }

  dump(): StoreDump {
    const d: StoreDump = { version: 1, readings: {}, weather: {}, fires: {}, incidents: [...this.incidents.values()] };
    for (const ds of DATASETS) {
      d.readings[ds] = [...this.readings.entries()].filter(([k]) => k.startsWith(`${ds}#`)).flatMap(([, m]) => [...m.values()]);
      d.weather[ds] = [...this.weatherOf(ds).values()];
      d.fires[ds] = Object.fromEntries(this.firesOf(ds));
    }
    return d;
  }

  /** Write the whole store to a file (STORE_FILE persistence, or the snapshot export). */
  saveTo(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(this.dump()));
  }

  private persist() {
    if (this.file) this.saveTo(this.file);
  }

  private weatherOf(ds: Dataset) {
    if (!this.weather.has(ds)) this.weather.set(ds, new Map());
    return this.weather.get(ds)!;
  }
  private firesOf(ds: Dataset) {
    if (!this.fires.has(ds)) this.fires.set(ds, new Map());
    return this.fires.get(ds)!;
  }
  private putSync(ds: Dataset, rows: Reading[]) {
    for (const r of rows) {
      const key = `${ds}#${r.stationId}`;
      if (!this.readings.has(key)) this.readings.set(key, new Map());
      const ts = iso(r.ts);
      this.readings.get(key)!.set(ts, { ...r, ts });
    }
  }

  async putReadings(ds: Dataset, rows: Reading[]) {
    this.putSync(ds, rows);
    this.persist();
  }

  async getReadings(ds: Dataset, stationId: string, fromIso: string, toIso: string) {
    const from = iso(fromIso), to = iso(toIso);
    return [...(this.readings.get(`${ds}#${stationId}`)?.values() ?? [])]
      .filter((r) => r.ts >= from && r.ts <= to)
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }

  async getLatestReadings(ds: Dataset) {
    const out: Reading[] = [];
    for (const [key, m] of this.readings) {
      if (!key.startsWith(`${ds}#`) || m.size === 0) continue;
      out.push([...m.values()].reduce((a, b) => (b.ts > a.ts ? b : a)));
    }
    return out;
  }

  async putWeather(ds: Dataset, rows: Weather[]) {
    for (const w of rows) this.weatherOf(ds).set(iso(w.ts), { ...w, ts: iso(w.ts) });
    this.persist();
  }

  async getWeather(ds: Dataset, fromIso: string, toIso: string) {
    const from = iso(fromIso), to = iso(toIso);
    return [...this.weatherOf(ds).values()].filter((w) => w.ts >= from && w.ts <= to).sort((a, b) => a.ts.localeCompare(b.ts));
  }

  async putFires(ds: Dataset, date: string, rows: Fire[]) {
    this.firesOf(ds).set(date, rows);
    this.persist();
  }

  async getFires(ds: Dataset, fromIso: string, toIso: string) {
    const from = iso(fromIso), to = iso(toIso);
    return [...this.firesOf(ds).values()].flat().filter((f) => {
      const t = iso(f.acquiredAt);
      return t >= from && t <= to;
    });
  }

  async putIncident(incident: Incident) {
    this.incidents.set(incident.id, structuredClone(incident));
    this.persist();
  }

  async getIncident(id: string) {
    const i = this.incidents.get(id);
    return i ? structuredClone(i) : null;
  }

  async listIncidents(f: IncidentFilter) {
    return [...this.incidents.values()].filter((i) => matchIncident(i, f)).sort(newestFirst).map((i) => structuredClone(i));
  }
}
