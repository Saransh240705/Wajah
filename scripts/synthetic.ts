// SYNTHETIC replay data for local acceptance checks of the work order loop. Never load this to AWS or show it
// in the demo: the real replay dataset comes from scripts/seed-replay.ts.
//
// Five days, every station flat except Anand Vihar, which has a dust spike each morning. Days 1-4 fade on
// their own (the unacted pool); day 5 is the target incident that a work order acts on.
//
// CLI: npx tsx scripts/synthetic.ts [.data/synthetic.json]   then   STORE_FILE=.data/synthetic.json npm run dev:api
import { fileURLToPath } from 'node:url';
import { config, type Incident, type Reading, type Station, type Weather } from '@wajah/shared';
import stationsJson from '@wajah/shared/stations.json' with { type: 'json' };
import { scoreCauses } from '../api/src/modules/fingerprint/score';
import { MemoryStore } from '../api/src/store/memory';

const H = 3600_000;
const T0 = Date.parse('2025-11-01T00:00:00.000Z');
const DAYS = 5;
const SPIKE_HOUR = 6; // UTC, 11:30 India time
const at = (h: number) => new Date(T0 + h * H).toISOString();

/** PM10 through a spike, hour 0 = spike start. The fade is what happens with nobody acting. */
export const FADE = [300, 420, 400, 380, 350, 330, 320, 200];
export const ACTED = [300, 420, 400, 300, 240, 230, 220, 200];

export function buildSyntheticStore(opts: { targetPm10?: number[] } = {}): { store: MemoryStore; targetId: string; poolIds: string[] } {
  const store = new MemoryStore({ seed: 'none' });
  const stations = stationsJson as Station[];
  const readings: Reading[] = [];
  const weather: Weather[] = [];
  for (let h = 0; h < DAYS * 24; h++) {
    weather.push({ ts: at(h), windSpeed: 3, windDir: 290, blh: 800, precip: 0 });
    for (const s of stations) {
      const day = Math.floor(h / 24), hod = h % 24;
      const k = hod - SPIKE_HOUR;
      const series = day === DAYS - 1 ? (opts.targetPm10 ?? ACTED) : FADE;
      const pm10 = s.id === 'anand-vihar' && k >= 0 && k < series.length ? series[k]! : 200;
      const pm25 = s.id === 'anand-vihar' && k >= 0 && k < series.length ? Math.round(pm10 * 0.32) : 120;
      readings.push({ stationId: s.id, ts: at(h), pm25, pm10, no2: 40, co: 1.1, so2: null, o3: null, source: 'modelled' });
    }
  }
  const ids: string[] = [];
  for (let day = 0; day < DAYS; day++) {
    const start = at(day * 24 + SPIKE_HOUR);
    const features = { pmRatio: 0.32, coRise: 1.0, no2Rise: 1.0, spatialShare: 1 / 14, windSpeed: 3, windDir: 290, blh: 800, upwindFires: 2, hourBand: 'day' as const };
    const sc = scoreCauses(features, config);
    const inc: Incident = {
      id: `replay-anand-vihar-${start.slice(0, 13).replace(/[-T]/g, '')}`, dataset: 'replay', stationId: 'anand-vihar', area: 'Anand Vihar',
      start, end: at(day * 24 + SPIKE_HOUR + 6), peakPm25: Math.round(420 * 0.32), peakPm10: 420, peakAt: at(day * 24 + SPIKE_HOUR + 1), baselinePm25: 120,
      features, scores: sc.scores, topCause: sc.topCause, confidence: sc.confidence, evidence: sc.evidence,
      status: 'open', recurrenceCount: 0, escalationLevel: 0, workOrders: [], checks: [], createdAt: start, updatedAt: start,
    };
    void store.putIncident(inc);
    ids.push(inc.id);
  }
  void store.putReadings('replay', readings);
  void store.putWeather('replay', weather);
  return { store, targetId: ids.at(-1)!, poolIds: ids.slice(0, -1) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? '.data/synthetic.json';
  const { store, targetId } = buildSyntheticStore();
  store.saveTo(out);
  console.log(`SYNTHETIC replay store written to ${out}. Target incident: ${targetId}`);
}
