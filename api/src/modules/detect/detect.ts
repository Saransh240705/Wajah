// Spike detection, master PRD 4.1. Pure.
import { config, type Reading } from '@wajah/shared';

type DetectCfg = typeof config.detect;
const H = 3600_000;
const D = 24 * H;
const floorHour = (ms: number) => Math.floor(ms / H) * H;

export interface SpikeWindow {
  start: string;           // first spike hour
  end: string | null;      // end of the last spike hour; null while still running
  peakPm25: number;
  peakPm10: number | null;
  peakAt: string;
  baseline: number;        // baseline PM2.5 at the start hour
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

interface Hourly { t: number; pm25: number | null; pm10: number | null }

function hourly(readings: Reading[]): Hourly[] {
  const by = new Map<number, Hourly>();
  for (const r of readings) {
    const t = floorHour(Date.parse(r.ts));
    by.set(t, { t, pm25: r.pm25, pm10: r.pm10 });
  }
  return [...by.values()].sort((a, b) => a.t - b.t);
}

/**
 * Baseline at hour t: median PM2.5 over the previous `baselineDays` days, or over the previous 24 hours when
 * fewer than `minBaselineDays` days of data exist before t.
 */
export function baselineAt(rows: Hourly[], t: number, cfg: DetectCfg = config.detect): number | null {
  const prior = rows.filter((r) => r.t < t && r.t >= t - cfg.baselineDays * D && r.pm25 != null);
  const days = new Set(prior.map((r) => Math.floor(r.t / D))).size;
  const use = days >= cfg.minBaselineDays ? prior : prior.filter((r) => r.t >= t - cfg.fallbackBaselineHours * H);
  return median(use.map((r) => r.pm25!));
}

export function isSpike(pm25: number | null, baseline: number | null, cfg: DetectCfg = config.detect): boolean {
  if (pm25 == null || baseline == null) return false;
  return pm25 >= cfg.minSpikePm25 && pm25 >= Math.max(cfg.baselineFactor * baseline, baseline + cfg.baselineAdd);
}

/** Every spike hour (ms) at one station, with the baseline used. */
export function spikeHours(readings: Reading[], cfg: DetectCfg = config.detect): Map<number, number> {
  const rows = hourly(readings);
  const out = new Map<number, number>();
  for (const r of rows) {
    const b = baselineAt(rows, r.t, cfg);
    if (isSpike(r.pm25, b, cfg)) out.set(r.t, b!);
  }
  return out;
}

/** Incident windows at one station: runs of spike hours, merged across short gaps, needing a long enough run. */
export function detectIncidents(readings: Reading[], cfg: DetectCfg = config.detect): SpikeWindow[] {
  const rows = hourly(readings);
  if (!rows.length) return [];
  const spikes = spikeHours(readings, cfg);
  const byT = new Map(rows.map((r) => [r.t, r]));
  const lastT = rows.at(-1)!.t;

  // Runs of consecutive spike hours
  const runs: { from: number; to: number }[] = [];
  for (const t of [...spikes.keys()].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && t === last.to + H) last.to = t;
    else runs.push({ from: t, to: t });
  }
  // Merge runs separated by mergeGapHours or fewer non-spike hours
  const merged: { from: number; to: number; longest: number }[] = [];
  for (const r of runs) {
    const len = (r.to - r.from) / H + 1;
    const last = merged.at(-1);
    if (last && (r.from - last.to) / H - 1 <= cfg.mergeGapHours) {
      last.to = r.to;
      last.longest = Math.max(last.longest, len);
    } else merged.push({ ...r, longest: len });
  }

  return merged
    .filter((w) => w.longest >= cfg.minSpikeHours)
    .map((w) => {
      let peak: Hourly | undefined;
      let peakPm10: number | null = null;
      for (let t = w.from; t <= w.to; t += H) {
        const r = byT.get(t);
        if (r?.pm25 != null && (!peak || r.pm25 > peak.pm25!)) peak = r;
        if (r?.pm10 != null) peakPm10 = Math.max(peakPm10 ?? 0, r.pm10);
      }
      // Closed once enough observed non-spike hours follow the last spike hour
      const after = rows.filter((r) => r.t > w.to && !spikes.has(r.t)).length;
      const closed = after >= cfg.closeAfterHours || w.to < lastT - cfg.closeAfterHours * H;
      return {
        start: new Date(w.from).toISOString(),
        end: closed ? new Date(w.to + H).toISOString() : null,
        peakPm25: peak!.pm25!,
        peakPm10,
        peakAt: new Date(peak!.t).toISOString(),
        baseline: Math.round(spikes.get(w.from)! * 10) / 10,
      };
    });
}
