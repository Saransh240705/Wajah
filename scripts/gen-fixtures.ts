// Generates the mock fixtures in shared/fixtures/ (master PRD section 10, "Fixtures to update after the pivot").
// Values are illustrative samples for mock mode, not real readings or real results.
// Run: npx tsx scripts/gen-fixtures.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS, PLAYBOOKS, config, pm25Band,
  type ActionType, type Agency, type AskResponse, type Board, type BoardItem, type Cause, type EffectResult,
  type Features, type Fire, type Incident, type IncidentStatus, type Ledger, type LedgerRow, type Reading,
  type Scoreboard, type Station, type StationSummary, type Verdict, type Weather, type WorkOrder,
} from '@wajah/shared';
import stations from '@wajah/shared/stations.json' with { type: 'json' };
import { scoreCauses } from '../api/src/modules/fingerprint/score';
import { buildInstructions } from '../api/src/modules/workorders/instructions';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'shared', 'fixtures');
const NOW = '2026-10-09T08:00:00.000Z'; // 13:30 India time, Fri 9 Oct
const H = 3600_000;
const at = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * H).toISOString();
const STATIONS = stations as Station[];
const station = (id: string) => STATIONS.find((s) => s.id === id)!;
const TOTAL = 14;

// Deterministic noise
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const jitter = (v: number, pct: number) => Math.round(v * (1 + (rand() * 2 - 1) * pct));

interface Spec {
  stationId: string; start: string; end: string | null; peakAt: string;
  peakPm25: number; peakPm10: number | null; baseline: number; spiked: number;
  features: Omit<Features, 'spatialShare'>; status: IncidentStatus;
  recurrenceCount?: number; escalationLevel?: number; checks?: Incident['checks'];
}

function incident(s: Spec): Incident {
  const st = station(s.stationId);
  const features: Features = { ...s.features, spatialShare: Math.round((s.spiked / TOTAL) * 100) / 100 };
  const r = scoreCauses(features, config, { spikedStations: s.spiked, stationsWithData: TOTAL });
  const ymdh = s.start.slice(0, 13).replace(/[-T]/g, '');
  return {
    id: `live-${s.stationId}-${ymdh}`, dataset: 'live', stationId: s.stationId, area: st.area,
    start: s.start, end: s.end, peakPm25: s.peakPm25, peakPm10: s.peakPm10, peakAt: s.peakAt, baselinePm25: s.baseline,
    features, scores: r.scores, topCause: r.topCause, confidence: r.confidence, evidence: r.evidence,
    status: s.status, recurrenceCount: s.recurrenceCount ?? 0, escalationLevel: s.escalationLevel ?? 0,
    workOrders: [], checks: s.checks ?? [], createdAt: at(s.start, 1), updatedAt: NOW,
  };
}

function reason(cause: Cause, actionType: ActionType, tried: number, worked: number, noEffect = tried - worked): string {
  const pb = PLAYBOOKS[cause];
  if (!pb.localActionPossible) return `${pb.likelyEn} ${pb.doNotEn}`;
  const short = ACTIONS[actionType].shortEn;
  if (tried === 0) return `${pb.likelyEn} ${short} has not been tried here yet.`;
  if (worked === 0 && noEffect === 0) return `${pb.likelyEn} ${short} has no measured result here yet.`;
  if (worked === 0) return `${pb.likelyEn} ${short} here had no effect ${noEffect} of ${tried} times.`;
  return `${pb.likelyEn} ${short} here worked ${worked} of ${tried} times.`;
}

function effect(pollutant: 'pm25' | 'pm10', before: number, after: number, expected: number, city: number, measuredAt: string, force?: { verdict: Verdict; note: string }): EffectResult {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const changePct = r1(((after - before) / before) * 100);
  const netChangePct = r1(changePct - expected);
  const verdict: Verdict = force?.verdict ?? (netChangePct <= config.effect.workedNetPct ? 'worked' : 'no_effect');
  return { pollutant, beforeMean: before, afterMean: after, changePct, expectedChangePct: expected, cityChangePct: city, netChangePct, verdict, ...(force ? { note: force.note } : {}), measuredAt };
}

function wo(inc: Incident, n: number, actionType: ActionType, agency: Agency, extra: Partial<WorkOrder> & { issuedAt: string; status: WorkOrder['status'] }, history: [number, number] = [0, 0]): WorkOrder {
  const ins = buildInstructions(inc, actionType, agency, { usualPm10: inc.topCause === 'dust' ? 190 : null });
  const w: WorkOrder = {
    id: `${inc.id}-w${n}`, incidentId: inc.id, stationId: inc.stationId, area: inc.area,
    actionType, agency, reason: reason(inc.topCause, actionType, ...history),
    instructionsEn: ins.en, instructionsHi: ins.hi, escalationLevel: 0, demo: true, ...extra,
  };
  inc.workOrders.push(w);
  return w;
}

// ---- Incidents: all five causes, all four statuses, every work order status, all three verdicts
const anand = incident({ stationId: 'anand-vihar', start: '2026-10-08T07:00:00.000Z', end: '2026-10-08T10:00:00.000Z', peakAt: '2026-10-08T08:00:00.000Z', peakPm25: 150, peakPm10: 480, baseline: 62, spiked: 2, status: 'dispatched',
  features: { pmRatio: 0.31, coRise: 1.05, no2Rise: 1.1, windSpeed: 5.1, windDir: 290, blh: 900, upwindFires: 3, hourBand: 'day' } });
wo(anand, 1, 'water_sprinkling', 'PWD', { status: 'done', issuedAt: '2026-10-08T08:35:00.000Z', startedAt: '2026-10-08T08:55:00.000Z', doneAt: '2026-10-08T09:40:00.000Z',
  photo: { key: `photos/${anand.id}-w1.jpg`, result: 'pass', note: 'A water tanker is spraying a road.' },
  effect: effect('pm10', 430, 290, -10, -4.1, '2026-10-08T13:00:00.000Z') }, [3, 2]);

const jahangirpuri = incident({ stationId: 'jahangirpuri', start: '2026-10-06T16:00:00.000Z', end: '2026-10-06T19:00:00.000Z', peakAt: '2026-10-06T17:00:00.000Z', peakPm25: 310, peakPm10: 425, baseline: 118, spiked: 5, status: 'cleared',
  features: { pmRatio: 0.73, coRise: 1.4, no2Rise: 1.25, windSpeed: 1.2, windDir: 200, blh: null, upwindFires: 12, hourBand: 'night' },
  checks: [{ date: '2026-10-07', result: 'clean', peakPm25: 140 }, { date: '2026-10-08', result: 'clean', peakPm25: 128 }] });
wo(jahangirpuri, 1, 'anti_burning_patrol', 'MCD', { status: 'cancelled', issuedAt: '2026-10-06T17:10:00.000Z' }, [2, 1]);
wo(jahangirpuri, 2, 'anti_burning_patrol', 'MCD', { status: 'done', issuedAt: '2026-10-06T17:20:00.000Z', startedAt: '2026-10-06T17:35:00.000Z', doneAt: '2026-10-06T18:30:00.000Z',
  effect: effect('pm25', 300, 190, -14.2, -3, '2026-10-06T22:00:00.000Z') }, [2, 1]);

const mundka = incident({ stationId: 'mundka', start: '2026-10-07T05:00:00.000Z', end: '2026-10-07T10:00:00.000Z', peakAt: '2026-10-07T07:00:00.000Z', peakPm25: 160, peakPm10: 440, baseline: 74, spiked: 8, status: 'recurred',
  recurrenceCount: 1, escalationLevel: 1,
  features: { pmRatio: 0.36, coRise: 1.2, no2Rise: 1.15, windSpeed: 3.2, windDir: 270, blh: 1100, upwindFires: 20, hourBand: 'day' },
  checks: [{ date: '2026-10-08', result: 'recurred', peakPm25: 150 }] });
wo(mundka, 1, 'water_sprinkling', 'PWD', { status: 'done', issuedAt: '2026-10-07T06:00:00.000Z', startedAt: '2026-10-07T06:20:00.000Z', doneAt: '2026-10-07T07:20:00.000Z',
  effect: effect('pm10', 420, 370, -9.8, -3.5, '2026-10-07T11:00:00.000Z') }, [1, 0]);
wo(mundka, 2, 'mechanical_sweeping', 'MCD', { status: 'issued', issuedAt: '2026-10-09T07:40:00.000Z', escalationLevel: 1 }, [0, 0]);
mundka.workOrders[1]!.reason = `${PLAYBOOKS.dust.likelyEn} Sprinkling here had no effect 2 of 2 times, so try mechanical sweeping.`;

const punjabi = incident({ stationId: 'punjabi-bagh', start: '2026-10-09T02:00:00.000Z', end: '2026-10-09T05:00:00.000Z', peakAt: '2026-10-09T03:00:00.000Z', peakPm25: 215, peakPm10: 370, baseline: 84, spiked: 3, status: 'dispatched',
  features: { pmRatio: 0.58, coRise: 1.3, no2Rise: 1.8, windSpeed: 2.0, windDir: 310, blh: 450, upwindFires: 8, hourBand: 'morning_rush' } });
wo(punjabi, 1, 'traffic_management', 'Traffic Police', { status: 'done', issuedAt: '2026-10-09T03:05:00.000Z', startedAt: '2026-10-09T03:10:00.000Z', doneAt: '2026-10-09T04:00:00.000Z',
  effect: effect('pm25', 210, 150, -8, -27.3, '2026-10-09T07:30:00.000Z', { verdict: 'inconclusive', note: 'the whole city shifted at once' }) });
wo(punjabi, 2, 'traffic_management', 'Traffic Police', { status: 'in_progress', issuedAt: '2026-10-09T06:10:00.000Z', startedAt: '2026-10-09T06:30:00.000Z' }, [1, 0]);

const ito = incident({ stationId: 'ito', start: '2026-10-09T00:00:00.000Z', end: null, peakAt: '2026-10-09T06:00:00.000Z', peakPm25: 420, peakPm10: 610, baseline: 158, spiked: 12, status: 'open',
  features: { pmRatio: 0.69, coRise: 1.15, no2Rise: 1.05, windSpeed: 2.6, windDir: 305, blh: 350, upwindFires: 210, hourBand: 'day' } });

const vivek = incident({ stationId: 'vivek-vihar', start: '2026-10-08T17:00:00.000Z', end: '2026-10-08T20:00:00.000Z', peakAt: '2026-10-08T18:00:00.000Z', peakPm25: 240, peakPm10: 330, baseline: 100, spiked: 7, status: 'open',
  features: { pmRatio: 0.55, coRise: 1.3, no2Rise: 1.1, windSpeed: 1.1, windDir: 180, blh: null, upwindFires: 30, hourBand: 'night' } });

const narela = incident({ stationId: 'narela', start: '2026-10-07T18:00:00.000Z', end: '2026-10-07T23:00:00.000Z', peakAt: '2026-10-07T20:00:00.000Z', peakPm25: 280, peakPm10: 390, baseline: 110, spiked: 11, status: 'dispatched',
  features: { pmRatio: 0.72, coRise: 1.25, no2Rise: 1.3, windSpeed: 0.8, windDir: 90, blh: 200, upwindFires: 5, hourBand: 'night' } });
wo(narela, 1, 'public_advisory', 'Residents', { status: 'done', issuedAt: '2026-10-07T19:00:00.000Z', doneAt: '2026-10-07T19:00:00.000Z' });

const wazirpur = incident({ stationId: 'wazirpur', start: '2026-10-09T05:00:00.000Z', end: null, peakAt: '2026-10-09T07:00:00.000Z', peakPm25: 260, peakPm10: 360, baseline: 96, spiked: 2, status: 'open',
  features: { pmRatio: 0.7, coRise: 1.5, no2Rise: 1.1, windSpeed: 1.4, windDir: 240, blh: 600, upwindFires: 6, hourBand: 'day' } });

const incidents = [wazirpur, ito, punjabi, mundka, vivek, anand, narela, jahangirpuri]
  .sort((a, b) => b.start.localeCompare(a.start));

// ---- Ledger
const rows: LedgerRow[] = [
  { stationId: 'anand-vihar', area: 'Anand Vihar', actionType: 'water_sprinkling', tried: 4, worked: 3, noEffect: 1, inconclusive: 0, avgNetChangePct: -18.4, illustrative: false },
  { stationId: 'jahangirpuri', area: 'Jahangirpuri', actionType: 'anti_burning_patrol', tried: 3, worked: 2, noEffect: 1, inconclusive: 0, avgNetChangePct: -14.9, illustrative: false },
  { stationId: 'mundka', area: 'Mundka', actionType: 'water_sprinkling', tried: 2, worked: 0, noEffect: 2, inconclusive: 0, avgNetChangePct: -1.6, illustrative: false },
  { stationId: 'punjabi-bagh', area: 'Punjabi Bagh', actionType: 'traffic_management', tried: 1, worked: 0, noEffect: 0, inconclusive: 1, avgNetChangePct: null, illustrative: false },
  { stationId: 'wazirpur', area: 'Wazirpur', actionType: 'anti_burning_patrol', tried: 2, worked: 1, noEffect: 1, inconclusive: 0, avgNetChangePct: -9.8, illustrative: false },
  { stationId: 'rohini', area: 'Rohini', actionType: 'anti_burning_patrol', tried: 1, worked: 1, noEffect: 0, inconclusive: 0, avgNetChangePct: -21.0, illustrative: true },
  { stationId: 'okhla', area: 'Okhla', actionType: 'mechanical_sweeping', tried: 1, worked: 0, noEffect: 1, inconclusive: 0, avgNetChangePct: -4.2, illustrative: false },
  { stationId: 'rk-puram', area: 'R K Puram', actionType: 'water_sprinkling', tried: 2, worked: 1, noEffect: 0, inconclusive: 1, avgNetChangePct: -16.3, illustrative: false },
];
const sum = (k: 'tried' | 'worked' | 'noEffect' | 'inconclusive') => rows.reduce((a, r) => a + r[k], 0);
const ledger: Ledger = {
  totals: { issued: sum('tried') + 2, measured: sum('tried'), worked: sum('worked'), noEffect: sum('noEffect'), inconclusive: sum('inconclusive') },
  placebo: { tested: 24, wronglyWorked: 2 },
  rows,
};

// ---- Board: open or recurred, plus in-progress, local actions first
const hist = (stationId: string, actionType: ActionType) => {
  const r = rows.find((x) => x.stationId === stationId && x.actionType === actionType);
  return { tried: r?.tried ?? 0, worked: r?.worked ?? 0, noEffect: r?.noEffect ?? 0, avgNetChangePct: r?.avgNetChangePct ?? null };
};
function boardItem(inc: Incident, actionType: ActionType, agency: Agency, why?: string): BoardItem {
  const h = hist(inc.stationId, actionType);
  const priority = Math.round((inc.peakPm25 / inc.baselinePm25) * config.board.confidenceWeight[inc.confidence] * (1 + config.board.recurrenceBoost * inc.recurrenceCount) * 100) / 100;
  return { incident: inc, priority, localActionPossible: PLAYBOOKS[inc.topCause].localActionPossible,
    recommended: { actionType, agency, reason: why ?? reason(inc.topCause, actionType, h.tried, h.worked, h.noEffect) },
    history: { tried: h.tried, worked: h.worked, avgNetChangePct: h.avgNetChangePct } };
}
const items = [
  boardItem(wazirpur, 'anti_burning_patrol', 'MCD'),
  boardItem(mundka, 'mechanical_sweeping', 'MCD', mundka.workOrders[1]!.reason),
  boardItem(punjabi, 'traffic_management', 'Traffic Police'),
  boardItem(vivek, PLAYBOOKS[vivek.topCause].steps[0]!.actionType, PLAYBOOKS[vivek.topCause].steps[0]!.agency),
  boardItem(ito, 'public_advisory', 'Residents'),
].sort((a, b) => Number(b.localActionPossible) - Number(a.localActionPossible) || b.priority - a.priority);
const board: Board = {
  summary: {
    actionable: items.filter((i) => i.localActionPossible && i.incident.status !== 'dispatched').length,
    noLocalAction: items.filter((i) => !i.localActionPossible).length,
    inProgress: items.filter((i) => i.incident.status === 'dispatched').length,
  },
  items,
};

// ---- Stations with a latest reading covering every band
const latestPm25: Record<string, number> = {
  'anand-vihar': 268, mundka: 204, wazirpur: 188, jahangirpuri: 172, 'rk-puram': 112, rohini: 160, 'punjabi-bagh': 155,
  okhla: 98, bawana: 140, narela: 131, 'vivek-vihar': 122, dwarka: 74, 'ashok-vihar': 166, 'lodhi-road': 52, ito: 290, 'mandir-marg': 84, sirifort: 28,
};
const activeIncident = (id: string) => incidents.find((i) => i.stationId === id && (i.status === 'open' || i.status === 'recurred' || (i.status === 'dispatched' && i.end === null)))?.id ?? null;
const reading = (stationId: string, ts: string, pm25: number, ratio = 0.62, co = 1.4, no2 = 42): Reading => ({
  stationId, ts, pm25, pm10: Math.round(pm25 / ratio), no2, co, so2: jitter(14, 0.2), o3: jitter(28, 0.3), source: 'openaq',
});
const stationSummaries: StationSummary[] = STATIONS.map((s) => {
  const pm = latestPm25[s.id] ?? jitter(140, 0.35);
  return { ...s, latest: reading(s.id, NOW, pm, 0.6, Math.round(jitter(140, 0.2)) / 100, jitter(45, 0.3)), band: pm25Band(pm), openIncidentId: activeIncident(s.id) };
});

// ---- Rohini: 48 hours with one clear night spike, 22:00 to 01:00 India time on 8-9 Oct
const rohiniReadings: Reading[] = [];
const rohiniWeather: Weather[] = [];
const spikeHours: Record<string, number> = { '2026-10-08T16': 175, '2026-10-08T17': 262, '2026-10-08T18': 238, '2026-10-08T19': 152 };
for (let h = -47; h <= 0; h++) {
  const ts = at(NOW, h);
  const spike = spikeHours[ts.slice(0, 13)];
  const base = 78 + 18 * Math.sin(((h + 6) / 24) * 2 * Math.PI);
  const pm25 = spike ?? jitter(base, 0.08);
  rohiniReadings.push(reading('rohini', ts, pm25, spike ? 0.71 : 0.55, spike ? 2.3 : Math.round(jitter(140, 0.1)) / 100, spike ? 48 : jitter(40, 0.15)));
  rohiniWeather.push({ ts, windSpeed: Math.round(jitter(spike ? 90 : 220, 0.25)) / 100, windDir: jitter(spike ? 160 : 280, 0.1) % 360, blh: spike ? jitter(260, 0.1) : jitter(800, 0.3), precip: 0 });
}
const rohiniIncident = incident({ stationId: 'rohini', start: '2026-10-08T16:00:00.000Z', end: '2026-10-08T19:00:00.000Z', peakAt: '2026-10-08T17:00:00.000Z', peakPm25: 262, peakPm10: 369, baseline: 80, spiked: 2, status: 'open',
  features: { pmRatio: 0.71, coRise: 1.6, no2Rise: 1.15, windSpeed: 0.9, windDir: 160, blh: 260, upwindFires: 4, hourBand: 'night' } });

// ---- Fires over Punjab and Haryana (box 73,28,78,33)
const fires: Fire[] = Array.from({ length: 30 }, (_, i) => ({
  lat: Math.round((29.6 + rand() * 1.9) * 1e4) / 1e4,
  lon: Math.round((74.4 + rand() * 2.4) * 1e4) / 1e4,
  acquiredAt: at('2026-10-08T07:00:00.000Z', (i % 3) * 12 + (i % 2) * 1.5),
  frp: Math.round(rand() * 400) / 10 + 1,
  confidence: ['n', 'n', 'h', 'l'][i % 4]!,
}));

// ---- Scoreboard
const byStation = new Map<string, Incident[]>();
for (const i of incidents) byStation.set(i.stationId, [...(byStation.get(i.stationId) ?? []), i]);
const scoreboard: Scoreboard = {
  totals: {
    incidents: incidents.length,
    dispatched: incidents.filter((i) => i.status === 'dispatched').length,
    cleared: incidents.filter((i) => i.status === 'cleared').length,
    recurred: incidents.filter((i) => i.status === 'recurred').length,
  },
  areas: [...byStation.entries()].map(([stationId, list]) => ({
    stationId, area: list[0]!.area, incidents: list.length,
    recurred: list.filter((i) => i.status === 'recurred').length, cleared: list.filter((i) => i.status === 'cleared').length,
    topCause: list[0]!.topCause, lastIncidentAt: list[0]!.start,
  })).sort((a, b) => b.incidents - a.incidents || b.recurred - a.recurred),
};

// ---- Ask
const ask: { ask: AskResponse; brief: AskResponse } = {
  ask: {
    answer: 'PM10 at Anand Vihar peaked at 480 at 1:30pm yesterday, about 2.5 times the usual level. The likely cause is dust (confidence: high): coarse particles dominated, the wind was 5.1 m/s, and only 2 of 14 areas spiked. Water sprinkling through PWD worked here 3 of 4 times. Next step: open the incident to see the measured result of yesterday\'s work order.',
    evidence: anand.evidence.filter((c) => c.cause === anand.topCause),
    incidentId: anand.id,
    suggestedActions: [{ type: 'open_incident', label: 'Open the Anand Vihar incident', payload: { incidentId: anand.id } }],
  },
  brief: {
    answer: '1. Wazirpur: likely local burning, high confidence. Send an anti-burning patrol through MCD; it worked here 1 of 2 times.\n2. Mundka: dust again, but sprinkling had no effect here 2 of 2 times, so send mechanical sweeping through MCD.\n3. Vivek Vihar: cause unclear, low confidence. Check again next hour before sending a team.\nDo not deploy sprinklers for the city-wide haze at ITO and 11 other areas: smoke from farm fires is the likely cause and no local action will help.',
    evidence: [],
    suggestedActions: [{ type: 'open_board', label: 'Open the action board' }],
  },
};

const files: Record<string, unknown> = {
  'stations.json': stationSummaries,
  'readings-rohini.json': { station: station('rohini'), readings: rohiniReadings, weather: rohiniWeather, incidents: [rohiniIncident] },
  'incidents.json': incidents,
  'board.json': board,
  'ledger.json': ledger,
  'ask.json': ask,
  'scoreboard.json': scoreboard,
  'fires.json': fires,
};
mkdirSync(OUT, { recursive: true });
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2) + '\n');
  console.log(`wrote shared/fixtures/${name}`);
}
console.log('causes:', incidents.map((i) => `${i.area}=${i.topCause}/${i.confidence}/${i.status}`).join(', '));
