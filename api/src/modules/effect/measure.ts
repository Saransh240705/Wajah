// Effect measurement, master PRD section 4.7. Pure: everything it needs comes in through EffectInput.
import { config, type EffectResult, type Incident, type Reading, type Verdict, type Weather, type WorkOrder } from '@wajah/shared';

type EffectCfg = typeof config.effect;
type Pollutant = EffectResult['pollutant'];

const H = 3600_000;
const floorHour = (ms: number) => Math.floor(ms / H) * H;

export interface EffectInput {
  workOrder: WorkOrder;
  incident: Incident;
  /** Hourly readings for the target station around the window. */
  readings: Reading[];
  /** Hourly readings for every other station around the window, keyed by station id. */
  otherReadings: Record<string, Reading[]>;
  /** Stations with a work order in progress; left out of the city change. */
  inProgressStationIds: string[];
  /** Weather covering both windows. */
  weather: Weather[];
  /** Candidate incidents for the expected fade, with their own readings. Unacted ones are picked here. */
  pool: { incident: Incident; readings: Reading[] }[];
  hotspotStationIds: string[];
  /** Dataset clock; becomes measuredAt. */
  now: string;
  cfg?: EffectCfg;
}

export interface EffectWindows {
  /** Reference time T: startedAt, or issuedAt if never started. */
  ref: number;
  /** Hour starts (ms) of the before and after windows. */
  beforeHours: number[];
  afterHours: number[];
  /** Time at which the last after-window hour has ended. */
  afterEnd: number;
}

/** Before: the hours ending at or before T. After: the hours starting the hour after doneAt (or T if never done). */
export function windowsAt(refMs: number, doneMs: number, cfg: EffectCfg = config.effect): EffectWindows {
  const lastBeforeEnd = floorHour(refMs);
  const beforeHours = Array.from({ length: cfg.beforeHours }, (_, i) => lastBeforeEnd - (cfg.beforeHours - i) * H);
  const firstAfter = floorHour(doneMs) + H;
  const afterHours = Array.from({ length: cfg.afterHours }, (_, i) => firstAfter + i * H);
  return { ref: refMs, beforeHours, afterHours, afterEnd: firstAfter + cfg.afterHours * H };
}

export function effectWindows(wo: WorkOrder, cfg: EffectCfg = config.effect): EffectWindows {
  const ref = Date.parse(wo.startedAt ?? wo.issuedAt);
  const done = wo.doneAt ? Date.parse(wo.doneAt) : ref;
  return windowsAt(ref, done, cfg);
}

/** True once every after-window hour has ended by `now`. */
export function afterWindowComplete(wo: WorkOrder, now: string, cfg: EffectCfg = config.effect): boolean {
  return Date.parse(now) >= effectWindows(wo, cfg).afterEnd;
}

export function pollutantFor(incident: Incident): Pollutant {
  return incident.topCause === 'dust' ? 'pm10' : 'pm25';
}

/** Unacted: no work orders other than public advisories. */
export function isUnacted(incident: Incident): boolean {
  return incident.workOrders.every((w) => w.actionType === 'public_advisory');
}

interface WindowMean { mean: number | null; count: number }

function meanAt(readings: Reading[], hours: number[], pollutant: Pollutant): WindowMean {
  const byHour = new Map<number, number>();
  for (const r of readings) {
    const v = r[pollutant];
    if (v != null && Number.isFinite(v)) byHour.set(floorHour(Date.parse(r.ts)), v);
  }
  const vals = hours.map((h) => byHour.get(h)).filter((v): v is number => v != null);
  return { mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, count: vals.length };
}

function pctChange(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before <= 0) return null;
  return ((after - before) / before) * 100;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function weatherIn(weather: Weather[], hours: number[]) {
  const set = new Set(hours);
  const rows = weather.filter((w) => set.has(floorHour(Date.parse(w.ts))));
  const rain = rows.reduce((a, w) => a + (w.precip ?? 0), 0);
  const wind = rows.length ? rows.reduce((a, w) => a + w.windSpeed, 0) / rows.length : null;
  return { rain, wind };
}

/** Median change of unacted spikes at the same offset from their start (master PRD 4.7, expectedChangePct). */
function expectedChange(input: EffectInput, pollutant: Pollutant, cfg: EffectCfg): { value: number; size: number } | null {
  const { workOrder: wo, incident } = input;
  const start = Date.parse(incident.start);
  const refOffset = Date.parse(wo.startedAt ?? wo.issuedAt) - start;
  const doneOffset = (wo.doneAt ? Date.parse(wo.doneAt) : Date.parse(wo.startedAt ?? wo.issuedAt)) - start;

  const usable = input.pool
    .filter((p) => p.incident.id !== incident.id && isUnacted(p.incident))
    .map((p) => {
      const s = Date.parse(p.incident.start);
      const win = windowsAt(s + refOffset, s + doneOffset, cfg);
      const before = meanAt(p.readings, win.beforeHours, pollutant);
      const after = meanAt(p.readings, win.afterHours, pollutant);
      if (before.count < cfg.minReadingsPerWindow || after.count < cfg.minReadingsPerWindow) return null;
      const change = pctChange(before.mean, after.mean);
      return change == null ? null : { stationId: p.incident.stationId, change };
    })
    .filter((x): x is { stationId: string; change: number } => x != null);

  const own = usable.filter((u) => u.stationId === incident.stationId);
  if (own.length >= cfg.minStationPool) return { value: median(own.map((u) => u.change)), size: own.length };
  const hotspots = new Set(input.hotspotStationIds);
  const hot = usable.filter((u) => hotspots.has(u.stationId));
  if (hot.length >= cfg.minHotspotPool) return { value: median(hot.map((u) => u.change)), size: hot.length };
  return null;
}

/** Measure whether pollution fell more than it would have anyway. Pure. */
export function measureEffect(input: EffectInput): EffectResult {
  const cfg = input.cfg ?? config.effect;
  const round = (n: number) => {
    const f = 10 ** cfg.decimals;
    return Math.round(n * f) / f || 0; // avoid -0
  };
  const pollutant = pollutantFor(input.incident);
  const win = effectWindows(input.workOrder, cfg);

  const before = meanAt(input.readings, win.beforeHours, pollutant);
  const after = meanAt(input.readings, win.afterHours, pollutant);
  const change = pctChange(before.mean, after.mean) ?? 0;

  const expected = expectedChange(input, pollutant, cfg);
  const expectedPct = expected?.value ?? 0;

  // City change: other stations with full data in both windows and no work order in progress
  const skip = new Set([input.incident.stationId, ...input.inProgressStationIds]);
  const cityChanges = Object.entries(input.otherReadings)
    .filter(([id]) => !skip.has(id))
    .map(([, rows]) => {
      const b = meanAt(rows, win.beforeHours, pollutant);
      const a = meanAt(rows, win.afterHours, pollutant);
      return b.count === win.beforeHours.length && a.count === win.afterHours.length ? pctChange(b.mean, a.mean) : null;
    })
    .filter((x): x is number => x != null);
  const cityPct = cityChanges.length ? cityChanges.reduce((a, b) => a + b, 0) / cityChanges.length : 0;

  const wBefore = weatherIn(input.weather, win.beforeHours);
  const wAfter = weatherIn(input.weather, win.afterHours);

  const notes: string[] = [];
  if (before.count < cfg.minReadingsPerWindow) notes.push(`too few readings in the before window (${before.count})`);
  if (after.count < cfg.minReadingsPerWindow) notes.push(`too few readings in the after window (${after.count})`);
  if (Math.abs(cityPct) >= cfg.cityShiftLimitPct) notes.push(`the whole city shifted at once (${round(cityPct)}%)`);
  const rain = Math.max(wBefore.rain, wAfter.rain);
  if (rain > cfg.rainLimitMm) notes.push(`rain during the window (${round(rain)} mm)`);
  if (wBefore.wind != null && wAfter.wind != null && wBefore.wind > 0) {
    const ratio = wAfter.wind / wBefore.wind;
    if (ratio >= cfg.windShiftFactor || ratio <= 1 / cfg.windShiftFactor) {
      notes.push(`the wind changed sharply (${round(wBefore.wind)} to ${round(wAfter.wind)} m/s)`);
    }
  }
  const inconclusive = notes.length > 0;
  if (!expected) notes.push('no baseline yet');

  const netPct = change - expectedPct;
  const verdict: Verdict = inconclusive ? 'inconclusive' : round(netPct) <= cfg.workedNetPct ? 'worked' : 'no_effect';

  return {
    pollutant,
    beforeMean: round(before.mean ?? 0),
    afterMean: round(after.mean ?? 0),
    changePct: round(change),
    expectedChangePct: round(expectedPct),
    cityChangePct: round(cityPct),
    netChangePct: round(netPct),
    verdict,
    ...(notes.length ? { note: notes.join('; ') } : {}),
    measuredAt: input.now,
  };
}
