// Recurrence check, master PRD 4.8. Pure.
import { config, type Incident, type Reading, type VerifyCheck } from '@wajah/shared';

const H = 3600_000;
const D = 24 * H;
const floorHour = (ms: number) => Math.floor(ms / H) * H;
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface RecurrenceInput {
  incident: Incident;
  /** Other incidents at the same station in the same dataset (any status). */
  later: Incident[];
  /** Readings at the station after the incident, to record each night's peak. */
  readings: Reading[];
  now: string;
  cfg?: typeof config.recurrence;
}

/**
 * For each later night whose window has passed and is not checked yet: recurred if a new incident at the same
 * station with the same top cause overlaps [start hour - 1, end hour + 1] shifted by whole days, else clean.
 * Cleared after the configured number of consecutive clean nights, if the incident has a work order and none
 * of its work orders had no effect.
 */
export function checkRecurrence(input: RecurrenceInput): Incident {
  const cfg = input.cfg ?? config.recurrence;
  const inc = input.incident;
  if (inc.status === 'cleared') return inc;
  const now = Date.parse(input.now);
  const winStart = floorHour(Date.parse(inc.start)) - cfg.windowPadHours * H;
  const endMs = inc.end ? Date.parse(inc.end) : Date.parse(inc.peakAt);
  const winEnd = floorHour(endMs) + (1 + cfg.windowPadHours) * H;

  const done = new Set(inc.checks.map((c) => c.date));
  const checks: VerifyCheck[] = [...inc.checks];
  let recurrences = 0;

  for (let d = 1; winEnd + d * D <= now; d++) {
    const from = winStart + d * D, to = winEnd + d * D;
    const date = localDate.format(new Date(from));
    if (done.has(date)) continue;
    const inWindow = input.readings.filter((r) => {
      const t = Date.parse(r.ts);
      return t >= from && t < to;
    });
    const recurred = input.later.some((o) => o.id !== inc.id && o.stationId === inc.stationId && o.topCause === inc.topCause
      && Date.parse(o.start) < to && (o.end ? Date.parse(o.end) : Date.parse(o.peakAt)) >= from);
    if (!recurred && inWindow.length === 0) continue; // no data: cannot call the night clean
    const peaks = inWindow.map((r) => r.pm25).filter((v): v is number => v != null);
    checks.push({ date, result: recurred ? 'recurred' : 'clean', peakPm25: peaks.length ? Math.max(...peaks) : null });
    if (recurred) recurrences++;
  }

  const out: Incident = { ...inc, checks, updatedAt: checks.length !== inc.checks.length ? input.now : inc.updatedAt };
  if (recurrences > 0) {
    out.recurrenceCount = inc.recurrenceCount + recurrences;
    out.status = 'recurred';
  }
  let trailingClean = 0;
  for (let i = checks.length - 1; i >= 0 && checks[i]!.result === 'clean'; i--) trailingClean++;
  const noEffect = inc.workOrders.some((w) => w.effect?.verdict === 'no_effect');
  if (trailingClean >= cfg.cleanNightsToClear && inc.workOrders.length > 0 && !noEffect) out.status = 'cleared';
  return out;
}
