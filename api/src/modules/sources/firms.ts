// NASA FIRMS adapter. Written against shared/fixtures/raw/firms-viirs-snpp-nrt-2d.csv,
// firms-viirs-snpp-sp-2025-11-01.csv and firms-data-availability.csv.
import type { Fire } from '@wajah/shared';
import { fetchWithTimeout } from './http';
import type { FireFetcher } from './types';

const BASE = 'https://firms.modaps.eosdis.nasa.gov/api';
export const FIRMS_BOX = '73,28,78,33'; // Punjab and Haryana (master PRD section 8)
const MAX_DAYS = 5;                     // per area request
const D = 24 * 3600_000;

/** Parse an area CSV by header name. acq_time is UTC HHMM and may lack leading zeros. */
export function parseFirmsCsv(csv: string): Fire[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0]!.split(',');
  const col = (n: string) => head.indexOf(n);
  const [lat, lon, date, time, conf, frp] = ['latitude', 'longitude', 'acq_date', 'acq_time', 'confidence', 'frp'].map(col);
  if ([lat, lon, date, time].some((i) => i! < 0)) throw new Error(`FIRMS CSV has unexpected columns: ${lines[0]}`);
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    const hhmm = c[time!]!.padStart(4, '0');
    return {
      lat: Number(c[lat!]), lon: Number(c[lon!]),
      acquiredAt: `${c[date!]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00.000Z`,
      frp: Number(c[frp!] ?? 0), confidence: c[conf!] ?? '',
    };
  }).filter((f) => Number.isFinite(f.lat) && Number.isFinite(f.lon));
}

const key = () => {
  const k = process.env.FIRMS_MAP_KEY;
  if (!k) throw new Error('FIRMS_MAP_KEY is not set');
  return k;
};

async function area(source: string, days: number, date?: string): Promise<Fire[]> {
  const res = await fetchWithTimeout(`${BASE}/area/csv/${key()}/${source}/${FIRMS_BOX}/${days}${date ? `/${date}` : ''}`, {}, 'FIRMS');
  const text = await res.text();
  if (!text.startsWith('latitude')) throw new Error(`FIRMS returned no CSV: ${text.slice(0, 80)}`);
  return parseFirmsCsv(text);
}

/** Near-real-time detections for the last `days` days (ingest). */
export const fetchFires: FireFetcher = (days) => area('VIIRS_SNPP_NRT', Math.min(days, MAX_DAYS));

/** Detections between two dates for backfill and replay: standard processing (SP) where available, else NRT. */
export async function fetchFiresRange(fromIso: string, toIso: string): Promise<Fire[]> {
  const avail = await (await fetchWithTimeout(`${BASE}/data_availability/csv/${key()}/all`, {}, 'FIRMS')).text();
  const spMax = avail.split('\n').find((l) => l.startsWith('VIIRS_SNPP_SP,'))?.split(',')[2]?.trim() ?? '';
  const out: Fire[] = [];
  for (let t = Date.parse(fromIso.slice(0, 10)); t <= Date.parse(toIso); t += MAX_DAYS * D) {
    const day = new Date(t).toISOString().slice(0, 10);
    const days = Math.min(MAX_DAYS, Math.floor((Date.parse(toIso) - t) / D) + 1);
    out.push(...(await area(day <= spMax ? 'VIIRS_SNPP_SP' : 'VIIRS_SNPP_NRT', days, day)));
  }
  return out.filter((f) => f.acquiredAt >= fromIso.slice(0, 10) && f.acquiredAt <= toIso);
}
