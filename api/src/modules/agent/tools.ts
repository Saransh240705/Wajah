// The agent's nine tools (master PRD section 5), each a thin wrapper over an existing module.
// Outputs are kept small (about 1.5 KB) so the model sees summaries, never raw series.
import { tool } from '@strands-agents/sdk';
import { z } from 'zod';
import { ACTIONS, PLAYBOOKS, config, type Cause, type Dataset, type Incident, type Reading } from '@wajah/shared';
import { STATIONS, stationById } from '../../lib/stations';
import type { Store } from '../../store';
import { diagnoseRange } from '../fingerprint/diagnose';
import { angleDiff, bearingDeg, circularMeanDeg, haversineKm } from '../fingerprint/features';
import { isUnacted } from '../effect/measure';

const H = 3600_000;

// Hindi names, so "जहाँगीरपुरी" finds Jahangirpuri
const HINDI: Record<string, string> = {
  'anand-vihar': 'आनंद विहार', mundka: 'मुंडका', wazirpur: 'वज़ीरपुर वजीरपुर', jahangirpuri: 'जहाँगीरपुरी जहांगीरपुरी', 'rk-puram': 'आर के पुरम आरके पुरम',
  rohini: 'रोहिणी', 'punjabi-bagh': 'पंजाबी बाग', okhla: 'ओखला', bawana: 'बवाना', narela: 'नरेला', 'vivek-vihar': 'विवेक विहार', dwarka: 'द्वारका',
  'ashok-vihar': 'अशोक विहार', 'lodhi-road': 'लोधी रोड', ito: 'आईटीओ', 'mandir-marg': 'मंदिर मार्ग', sirifort: 'सीरी फोर्ट सिरीफोर्ट',
};

export interface ToolCapture { incident?: Incident; diagnosis?: { stationId: string; evidence: Incident['evidence']; topCause: Cause } }

const r1 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 10) / 10);
const ist = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function summarise(rows: Reading[], k: 'pm25' | 'pm10' | 'no2' | 'co') {
  const v = rows.filter((r) => r[k] != null);
  if (!v.length) return null;
  const peak = v.reduce((a, r) => (r[k]! > a[k]! ? r : a));
  return { peak: r1(peak[k]), peakAt: peak.ts, peakAtIndia: ist(peak.ts), mean: r1(v.reduce((a, r) => a + r[k]!, 0) / v.length), hours: v.length };
}

const brief = (i: Incident) => ({
  id: i.id, area: i.area, stationId: i.stationId, startIndia: ist(i.start), endIndia: i.end ? ist(i.end) : 'still running',
  peakPm25: i.peakPm25, peakPm10: i.peakPm10, usualPm25: i.baselinePm25, likelyCause: i.topCause, confidence: i.confidence, status: i.status,
  clues: i.evidence.filter((c) => c.cause === i.topCause).slice(0, 3).map((c) => c.label),
  workOrders: i.workOrders.map((w) => ({ action: w.actionType, agency: w.agency, status: w.status, verdict: w.effect?.verdict ?? null, netChangePct: w.effect?.netChangePct ?? null, demo: !!w.demo })),
});

/** Ledger rows from measured work orders. TODO(track-b): replace with buildLedger from api/src/modules/board. */
export function fallbackLedger(incidents: Incident[], stationId?: string) {
  const rows = new Map<string, { area: string; action: string; tried: number; worked: number; noEffect: number; inconclusive: number; nets: number[] }>();
  for (const i of incidents) {
    if (stationId && i.stationId !== stationId) continue;
    for (const w of i.workOrders) {
      if (!w.effect || !ACTIONS[w.actionType].measurable) continue;
      const k = `${i.stationId}|${w.actionType}`;
      const r = rows.get(k) ?? { area: i.area, action: w.actionType, tried: 0, worked: 0, noEffect: 0, inconclusive: 0, nets: [] };
      r.tried++;
      if (w.effect.verdict === 'worked') r.worked++;
      else if (w.effect.verdict === 'no_effect') r.noEffect++;
      else r.inconclusive++;
      if (w.effect.verdict !== 'inconclusive') r.nets.push(w.effect.netChangePct);
      rows.set(k, r);
    }
  }
  return [...rows.values()].slice(0, 10).map(({ nets, ...r }) => ({ ...r, avgNetChangePct: nets.length ? r1(nets.reduce((a, b) => a + b, 0) / nets.length) : null }));
}

/** Ranked board items. TODO(track-b): replace with buildBoard from api/src/modules/board. */
export function fallbackBoard(incidents: Incident[], now: string) {
  const since = new Date(Date.parse(now) - config.board.activeHours * H).toISOString();
  const ledger = fallbackLedger(incidents);
  return incidents
    .filter((i) => ((i.status === 'open' || i.status === 'recurred') && (i.end == null || i.end >= since)) || (i.status === 'dispatched' && i.workOrders.at(-1)?.status !== 'done' && i.workOrders.length > 0))
    .map((i) => {
      const pb = PLAYBOOKS[i.topCause];
      const step = pb.steps[i.status === 'recurred' ? Math.min(1, pb.steps.length - 1) : 0]!;
      const h = ledger.find((l) => l.area === i.area && l.action === step.actionType);
      const priority = (i.peakPm25 / i.baselinePm25) * config.board.confidenceWeight[i.confidence] * (1 + config.board.recurrenceBoost * i.recurrenceCount);
      return { incidentId: i.id, area: i.area, peakPm25: i.peakPm25, peakPm10: i.peakPm10, likelyCause: i.topCause, confidence: i.confidence, status: i.status,
        localActionPossible: pb.localActionPossible, action: step.actionType, agency: step.agency, history: h ? `worked ${h.worked} of ${h.tried}` : 'not tried here yet', priority: r1(priority)! };
    })
    .sort((a, b) => Number(b.localActionPossible) - Number(a.localActionPossible) || b.priority - a.priority)
    .slice(0, 5);
}

export function buildTools(store: Store, dataset: Dataset, now: string, capture: ToolCapture) {
  const iso = z.string().describe('ISO 8601 time in UTC, e.g. 2025-11-03T16:00:00Z');
  const all = () => store.listIncidents({ dataset });

  return [
    tool({
      name: 'find_station',
      description: 'Find monitoring stations matching a place name in English or Hindi. Returns station ids.',
      inputSchema: z.object({ query: z.string() }),
      callback: ({ query }) => {
        const q = query.toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]/g, ' ').trim();
        const hits = STATIONS.filter((s) => {
          const names = `${s.id} ${s.area} ${s.name} ${HINDI[s.id] ?? ''}`.toLowerCase();
          return q.split(/\s+/).some((w) => w.length > 2 && names.includes(w)) || names.includes(q);
        });
        return { stations: hits.slice(0, 5).map((s) => ({ id: s.id, area: s.area, name: s.name, isHotspot: s.isHotspot })) };
      },
    }),
    tool({
      name: 'get_readings',
      description: 'Summary of hourly readings at a station between two times: peak, mean and peak hour per pollutant (µg/m³; CO in mg/m³).',
      inputSchema: z.object({ stationId: z.string(), from: iso, to: iso }),
      callback: async ({ stationId, from, to }) => {
        const rows = await store.getReadings(dataset, stationId, from, to);
        if (!rows.length) return { stationId, message: 'no readings in this period' };
        return { stationId, hours: rows.length, pm25: summarise(rows, 'pm25'), pm10: summarise(rows, 'pm10'), no2: summarise(rows, 'no2'), co: summarise(rows, 'co') };
      },
    }),
    tool({
      name: 'list_incidents',
      description: 'Pollution spikes (incidents), newest first, with likely cause, confidence, clues, status and work order verdicts.',
      inputSchema: z.object({ stationId: z.string().optional(), since: iso.optional() }),
      callback: async ({ stationId, since }) => {
        const list = (await store.listIncidents({ dataset, stationId, sinceIso: since })).slice(0, 5);
        if (list[0]) capture.incident = list[0];
        return { incidents: list.map(brief), ...(list.length ? {} : { message: 'no incidents found' }) };
      },
    }),
    tool({
      name: 'diagnose',
      description: 'Score the five causes for a station over a time window: features, cause scores, likely cause, confidence and evidence clues.',
      inputSchema: z.object({ stationId: z.string(), from: iso, to: iso }),
      callback: async ({ stationId, from, to }) => {
        const s = stationById(stationId);
        if (!s) return { message: `unknown station ${stationId}` };
        const d = await diagnoseRange(store, dataset, s, from, to);
        if (!d) return { message: 'no readings in this window' };
        capture.diagnosis = { stationId, evidence: d.evidence.filter((c) => c.cause === d.topCause), topCause: d.topCause };
        return { area: d.area, peakPm25: d.peakPm25, peakAtIndia: ist(d.peakAt), likelyCause: d.topCause, confidence: d.confidence, scores: d.scores,
          features: d.features, clues: d.evidence.filter((c) => c.cause === d.topCause).map((c) => c.label) };
      },
    }),
    tool({
      name: 'get_wind',
      description: 'Delhi weather between two times: mean wind speed (m/s), wind-from direction (degrees), boundary layer height (m) and total rain (mm).',
      inputSchema: z.object({ from: iso, to: iso }),
      callback: async ({ from, to }) => {
        const w = await store.getWeather(dataset, from, to);
        if (!w.length) return { message: 'no weather data in this period' };
        const blh = w.map((x) => x.blh).filter((v): v is number => v != null);
        return { hours: w.length, meanWindSpeed: r1(w.reduce((a, x) => a + x.windSpeed, 0) / w.length), windFromDeg: r1(circularMeanDeg(w.map((x) => x.windDir))),
          meanBoundaryLayerM: blh.length ? Math.round(blh.reduce((a, b) => a + b, 0) / blh.length) : null, rainMm: r1(w.reduce((a, x) => a + (x.precip ?? 0), 0)) };
      },
    }),
    tool({
      name: 'get_upwind_fires',
      description: 'Satellite farm-fire detections in the 48 hours before a time, 50-450 km upwind of a station: count and total fire power.',
      inputSchema: z.object({ stationId: z.string(), at: iso }),
      callback: async ({ stationId, at }) => {
        const s = stationById(stationId);
        if (!s) return { message: `unknown station ${stationId}` };
        const f = config.features;
        const from = new Date(Date.parse(at) - f.fireLookbackHours * H).toISOString();
        const [fires, weather] = await Promise.all([store.getFires(dataset, from, at), store.getWeather(dataset, new Date(Date.parse(at) - 3 * H).toISOString(), at)]);
        const dir = circularMeanDeg(weather.map((w) => w.windDir));
        if (dir == null) return { message: 'no wind data, so upwind cannot be determined', firesInRegion: fires.length };
        const up = fires.filter((x) => {
          const km = haversineKm(s.lat, s.lon, x.lat, x.lon);
          return km >= f.fireMinKm && km <= f.fireMaxKm && angleDiff(bearingDeg(s.lat, s.lon, x.lat, x.lon), dir) <= f.fireSectorHalfDeg;
        });
        return { windFromDeg: Math.round(dir), upwindFires: up.length, totalFirePowerMW: r1(up.reduce((a, x) => a + x.frp, 0)), firesInRegion: fires.length };
      },
    }),
    tool({
      name: 'get_playbook',
      description: 'The recommended actions, agencies and protective advice for a cause.',
      inputSchema: z.object({ cause: z.enum(['local_burning', 'dust', 'traffic', 'regional_smoke', 'trapped_air']) }),
      callback: ({ cause }) => {
        const p = PLAYBOOKS[cause];
        return { cause, localActionPossible: p.localActionPossible, actions: p.steps.map((s, i) => ({ order: i === 0 ? 'first' : 'if no effect', action: ACTIONS[s.actionType].labelEn, agency: s.agency })),
          advice: p.adviceEn, doNot: p.doNotEn ?? null };
      },
    }),
    tool({
      name: 'get_board',
      description: 'The action board: spikes needing action now, highest priority first, with the recommended action, agency and ledger history.',
      inputSchema: z.object({}),
      callback: async () => ({ items: fallbackBoard(await all(), now) }),
    }),
    tool({
      name: 'get_ledger',
      description: 'What has worked: for each hotspot and action, how often it was tried, worked, had no effect or was inconclusive, and the average net change.',
      inputSchema: z.object({ stationId: z.string().optional() }),
      callback: async ({ stationId }) => {
        const incidents = await all();
        const rows = fallbackLedger(incidents, stationId);
        return { rows, unactedIncidents: incidents.filter(isUnacted).length, ...(rows.length ? {} : { message: 'no measured work orders yet' }) };
      },
    }),
  ];
}
