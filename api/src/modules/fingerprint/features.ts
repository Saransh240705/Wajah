// Features over an incident window, master PRD 4.2. Pure.
import { config, type Features, type Fire, type HourBand, type Reading, type Weather } from '@wajah/shared';
import { median } from '../detect/detect';

type FeatCfg = typeof config.features;
const H = 3600_000;
const D = 24 * H;
const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => ((r * 180) / Math.PI + 360) % 360;

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

/** Initial bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return deg(Math.atan2(y, x));
}

/** Smallest angle between two directions: 350 and 10 are 20 apart. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export function circularMeanDeg(dirs: number[]): number | null {
  if (!dirs.length) return null;
  const s = dirs.reduce((a, d) => a + Math.sin(rad(d)), 0);
  const c = dirs.reduce((a, d) => a + Math.cos(rad(d)), 0);
  if (Math.abs(s) < 1e-9 && Math.abs(c) < 1e-9) return null;
  return deg(Math.atan2(s, c));
}

const localHour = (ms: number, tz: string) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms)));

const inRange = (h: number, r: { from: number; to: number }) => (r.from <= r.to ? h >= r.from && h < r.to : h >= r.from || h < r.to);

export function hourBandAt(iso: string, cfg: FeatCfg = config.features, tz = config.timezone): HourBand {
  const h = localHour(Date.parse(iso), tz);
  const b = cfg.hourBands;
  if (inRange(h, b.night)) return 'night';
  if (inRange(h, b.morning_rush)) return 'morning_rush';
  if (inRange(h, b.evening_rush)) return 'evening_rush';
  return 'day';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pick = (rows: Reading[], k: 'pm25' | 'pm10' | 'co' | 'no2') => rows.map((r) => r[k]).filter((v): v is number => v != null);
const round = (n: number | null, dp = 2) => (n == null ? null : Math.round(n * 10 ** dp) / 10 ** dp);

export interface FeatureInput {
  window: { start: string; end: string | null; peakAt: string };
  station: { id: string; lat: number; lon: number };
  /** Target station readings covering at least the 7 days before the window and the window itself. */
  readings: Reading[];
  /** Spike hours (ms) per station, for every station, and readings per station to know who had data. */
  spikeHoursByStation: Map<string, Set<number>>;
  readingsByStation: Map<string, Reading[]>;
  weather: Weather[];
  fires: Fire[];
  /** Used when the window is still running. */
  now: string;
  cfg?: FeatCfg;
}

export interface FeatureResult { features: Features; spikedStations: number; stationsWithData: number }

export function computeFeatures(input: FeatureInput): FeatureResult {
  const cfg = input.cfg ?? config.features;
  const start = Date.parse(input.window.start);
  const end = input.window.end ? Date.parse(input.window.end) : Math.floor(Date.parse(input.now) / H) * H + H;
  const inW = (ts: string) => {
    const t = Date.parse(ts);
    return t >= start && t < end;
  };
  const w = input.readings.filter((r) => inW(r.ts));
  const prior = input.readings.filter((r) => {
    const t = Date.parse(r.ts);
    return t < start && t >= start - cfg.medianDays * D;
  });

  const pm25 = mean(pick(w, 'pm25')), pm10 = mean(pick(w, 'pm10'));
  const pmRatio = pm25 != null && pm10 ? pm25 / pm10 : null;
  const ratioTo = (k: 'co' | 'no2') => {
    const m = mean(pick(w, k)), base = median(pick(prior, k));
    return m != null && base ? m / base : null;
  };

  // Spatial share: stations with data in W that also had a spike hour in W (target included)
  let withData = 0, spiked = 0;
  for (const [id, rows] of input.readingsByStation) {
    if (!rows.some((r) => inW(r.ts) && r.pm25 != null)) continue;
    withData++;
    const sp = input.spikeHoursByStation.get(id);
    if (sp && [...sp].some((t) => t >= start && t < end)) spiked++;
  }

  const ww = input.weather.filter((x) => inW(x.ts));
  const windSpeed = mean(ww.map((x) => x.windSpeed));
  const windDir = circularMeanDeg(ww.map((x) => x.windDir));
  const blh = mean(ww.map((x) => x.blh).filter((v): v is number => v != null));

  // Fires in the previous 48 hours (to the peak), 50-450 km away, within the sector around the wind-from bearing
  const peak = Date.parse(input.window.peakAt);
  const { lat, lon } = input.station;
  const upwindFires = windDir == null ? 0 : input.fires.filter((f) => {
    const t = Date.parse(f.acquiredAt);
    if (t > peak || t < peak - cfg.fireLookbackHours * H) return false;
    const km = haversineKm(lat, lon, f.lat, f.lon);
    return km >= cfg.fireMinKm && km <= cfg.fireMaxKm && angleDiff(bearingDeg(lat, lon, f.lat, f.lon), windDir) <= cfg.fireSectorHalfDeg;
  }).length;

  return {
    features: {
      pmRatio: round(pmRatio),
      coRise: round(ratioTo('co')),
      no2Rise: round(ratioTo('no2')),
      spatialShare: withData ? round(spiked / withData)! : 0,
      windSpeed: round(windSpeed, 1),
      windDir: windDir == null ? null : Math.round(windDir),
      blh: blh == null ? null : Math.round(blh),
      upwindFires,
      hourBand: hourBandAt(input.window.peakAt, cfg),
    },
    spikedStations: spiked,
    stationsWithData: withData,
  };
}
