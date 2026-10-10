import type { Dataset, Fire, Incident, IncidentStatus, Reading, Weather } from '@wajah/shared';

// Master PRD section 9. Work orders are saved by calling putIncident with the updated incident.
export interface Store {
  putReadings(dataset: Dataset, rows: Reading[]): Promise<void>;
  getReadings(dataset: Dataset, stationId: string, fromIso: string, toIso: string): Promise<Reading[]>;
  getLatestReadings(dataset: Dataset): Promise<Reading[]>;   // one per station
  putWeather(dataset: Dataset, rows: Weather[]): Promise<void>;
  getWeather(dataset: Dataset, fromIso: string, toIso: string): Promise<Weather[]>;
  putFires(dataset: Dataset, date: string, rows: Fire[]): Promise<void>;
  getFires(dataset: Dataset, fromIso: string, toIso: string): Promise<Fire[]>;
  putIncident(incident: Incident): Promise<void>;
  getIncident(id: string): Promise<Incident | null>;
  listIncidents(filter: IncidentFilter): Promise<Incident[]>;
}

export interface IncidentFilter { dataset: Dataset; stationId?: string; status?: IncidentStatus; sinceIso?: string }

/** On-disk format for STORE_FILE and shared/fixtures/snapshot.json. */
export interface StoreDump {
  version: 1;
  readings: Partial<Record<Dataset, Reading[]>>;
  weather: Partial<Record<Dataset, Weather[]>>;
  fires: Partial<Record<Dataset, Record<string, Fire[]>>>;
  incidents: Incident[];
}

/** Normalise any ISO timestamp so string comparison orders correctly. */
export const iso = (s: string) => new Date(s).toISOString();

/** Incident filter shared by both stores: overlaps [sinceIso, now), newest first. */
export function matchIncident(i: Incident, f: IncidentFilter): boolean {
  return i.dataset === f.dataset
    && (!f.stationId || i.stationId === f.stationId)
    && (!f.status || i.status === f.status)
    && (!f.sinceIso || i.end == null || i.end >= iso(f.sinceIso));
}
export const newestFirst = (a: Incident, b: Incident) => b.start.localeCompare(a.start);
