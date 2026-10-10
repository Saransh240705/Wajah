// Diagnosis against the store, master PRD 4.1-4.4 and track A A2.4/A2.5.
import { config, type Dataset, type Incident, type Reading, type Station } from '@wajah/shared';
import { STATIONS } from '../../lib/stations';
import type { Store } from '../../store';
import { detectIncidents, spikeHours, type SpikeWindow } from '../detect/detect';
import { computeFeatures, type FeatureResult } from './features';
import { scoreCauses } from './score';

const H = 3600_000;
const D = 24 * H;
const iso = (ms: number) => new Date(ms).toISOString();

export const incidentId = (dataset: Dataset, stationId: string, start: string) =>
  `${dataset}-${stationId}-${start.slice(0, 13).replace(/[-T]/g, '')}`;

interface Context {
  readingsByStation: Map<string, Reading[]>;
  spikeHoursByStation: Map<string, Set<number>>;
  weather: Awaited<ReturnType<Store['getWeather']>>;
  fires: Awaited<ReturnType<Store['getFires']>>;
}

/** Load everything detection and features need for [fromMs, toMs], plus the baseline history before it. */
async function loadContext(store: Store, dataset: Dataset, fromMs: number, toMs: number, stations: Station[]): Promise<Context> {
  const dataFrom = iso(fromMs - (config.detect.baselineDays + 1) * D);
  const to = iso(toMs);
  const readingsByStation = new Map<string, Reading[]>();
  for (const s of stations) readingsByStation.set(s.id, await store.getReadings(dataset, s.id, dataFrom, to));
  const spikeHoursByStation = new Map<string, Set<number>>();
  for (const [id, rows] of readingsByStation) spikeHoursByStation.set(id, new Set(spikeHours(rows).keys()));
  const [weather, fires] = await Promise.all([
    store.getWeather(dataset, dataFrom, to),
    store.getFires(dataset, iso(Date.parse(dataFrom) - config.features.fireLookbackHours * H), to),
  ]);
  return { readingsByStation, spikeHoursByStation, weather, fires };
}

function features(ctx: Context, station: Station, window: Pick<SpikeWindow, 'start' | 'end' | 'peakAt'>, now: string): FeatureResult {
  return computeFeatures({
    window, station, readings: ctx.readingsByStation.get(station.id) ?? [],
    spikeHoursByStation: ctx.spikeHoursByStation, readingsByStation: ctx.readingsByStation,
    weather: ctx.weather, fires: ctx.fires, now,
  });
}

/** Build the incident for a window, keeping the lifecycle state of an existing one. */
export function buildIncident(dataset: Dataset, station: Station, w: SpikeWindow, f: FeatureResult, now: string, existing: Incident | null): Incident {
  const s = scoreCauses(f.features, config, { spikedStations: f.spikedStations, stationsWithData: f.stationsWithData });
  const fresh = {
    start: w.start, end: w.end, peakPm25: w.peakPm25, peakPm10: w.peakPm10, peakAt: w.peakAt, baselinePm25: w.baseline,
    features: f.features, scores: s.scores, topCause: s.topCause, confidence: s.confidence, evidence: s.evidence,
  };
  if (existing) {
    const changed = JSON.stringify(fresh) !== JSON.stringify({
      start: existing.start, end: existing.end, peakPm25: existing.peakPm25, peakPm10: existing.peakPm10, peakAt: existing.peakAt,
      baselinePm25: existing.baselinePm25, features: existing.features, scores: existing.scores, topCause: existing.topCause,
      confidence: existing.confidence, evidence: existing.evidence,
    });
    return changed ? { ...existing, ...fresh, updatedAt: now } : existing;
  }
  return {
    id: incidentId(dataset, station.id, w.start), dataset, stationId: station.id, area: station.area, ...fresh,
    status: 'open', recurrenceCount: 0, escalationLevel: 0, workOrders: [], checks: [], createdAt: now, updatedAt: now,
  };
}

export interface DetectionSummary {
  created: string[];
  updated: string[];
  unchanged: number;
  perStation: { stationId: string; incidents: number; maxPm25: number | null; rows: number }[];
}

/**
 * Detect incidents whose window touches [fromIso, now] at every station and upsert them. Safe to run twice.
 * Ingest passes the last 72 hours; backfill and replay pass the whole period.
 */
export async function runDetection(store: Store, dataset: Dataset, opts: { now: string; fromIso?: string; stations?: Station[] }): Promise<DetectionSummary> {
  const stations = opts.stations ?? STATIONS;
  const nowMs = Date.parse(opts.now);
  const fromMs = opts.fromIso ? Date.parse(opts.fromIso) : nowMs - config.detect.ingestLookbackHours * H;
  const ctx = await loadContext(store, dataset, fromMs, nowMs, stations);
  const out: DetectionSummary = { created: [], updated: [], unchanged: 0, perStation: [] };

  for (const station of stations) {
    const rows = ctx.readingsByStation.get(station.id) ?? [];
    const windows = detectIncidents(rows).filter((w) => w.end == null || Date.parse(w.end) >= fromMs);
    for (const w of windows) {
      const id = incidentId(dataset, station.id, w.start);
      const existing = await store.getIncident(id);
      const inc = buildIncident(dataset, station, w, features(ctx, station, w, opts.now), opts.now, existing);
      if (inc === existing) { out.unchanged++; continue; }
      await store.putIncident(inc);
      (existing ? out.updated : out.created).push(id);
    }
    const inRange = rows.filter((r) => Date.parse(r.ts) >= fromMs).map((r) => r.pm25).filter((v): v is number => v != null);
    out.perStation.push({ stationId: station.id, incidents: windows.length, maxPm25: inRange.length ? Math.max(...inRange) : null, rows: inRange.length });
  }
  return out;
}

/** Diagnose an arbitrary window at one station (the agent's `diagnose` tool). */
export async function diagnoseRange(store: Store, dataset: Dataset, station: Station, fromIso: string, toIso: string) {
  const from = Date.parse(fromIso), to = Date.parse(toIso);
  const ctx = await loadContext(store, dataset, from, to, STATIONS);
  const rows = (ctx.readingsByStation.get(station.id) ?? []).filter((r) => {
    const t = Date.parse(r.ts);
    return t >= from && t < to && r.pm25 != null;
  });
  if (!rows.length) return null;
  const peak = rows.reduce((a, r) => (r.pm25! > a.pm25! ? r : a));
  const f = features(ctx, station, { start: iso(from), end: iso(to), peakAt: peak.ts }, toIso);
  const s = scoreCauses(f.features, config, { spikedStations: f.spikedStations, stationsWithData: f.stationsWithData });
  return { stationId: station.id, area: station.area, from: iso(from), to: iso(to), peakPm25: peak.pm25, peakAt: peak.ts, ...f, ...s };
}
