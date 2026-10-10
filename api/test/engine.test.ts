import { describe, expect, it } from 'vitest';
import type { Features, Fire, Reading, Weather } from '@wajah/shared';
import { detectIncidents, spikeHours } from '../src/modules/detect/detect';
import { angleDiff, bearingDeg, circularMeanDeg, computeFeatures, haversineKm, hourBandAt } from '../src/modules/fingerprint/features';
import { scoreCauses } from '../src/modules/fingerprint/score';

const H = 3600_000;
const T0 = '2026-11-01T00:00:00.000Z';
const at = (h: number) => new Date(Date.parse(T0) + h * H).toISOString();
const r = (stationId: string, h: number, pm25: number | null, extra: Partial<Reading> = {}): Reading =>
  ({ stationId, ts: at(h), pm25, pm10: pm25 == null ? null : pm25 * 2, no2: 30, co: 1, so2: null, o3: null, source: 'openaq', ...extra });

/** 8 days flat at 100, then the given values from hour 192. */
function series(after: (number | null)[], stationId = 's1', flat = 100): Reading[] {
  return [...Array.from({ length: 192 }, (_, h) => r(stationId, h, flat)), ...after.map((v, i) => r(stationId, 192 + i, v))];
}

describe('A2.1 detectIncidents', () => {
  it('a flat series gives none', () => {
    expect(detectIncidents(series([100, 100, 100, 100, 100]))).toEqual([]);
  });

  it('a 3-hour spike gives one, with peak, baseline and a closed end', () => {
    const w = detectIncidents(series([100, 200, 260, 220, 100, 100, 100]));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ start: at(193), end: at(196), peakPm25: 260, peakAt: at(194), baseline: 100, peakPm10: 520 });
  });

  it('two spikes 1 hour apart merge into one', () => {
    const w = detectIncidents(series([200, 220, 100, 210, 230, 100, 100, 100]));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ start: at(192), end: at(197), peakPm25: 230 });
  });

  it('two spikes 2 hours apart stay separate', () => {
    expect(detectIncidents(series([200, 220, 100, 100, 210, 230, 100, 100, 100]))).toHaveLength(2);
  });

  it('a 1-hour blip gives none', () => {
    expect(detectIncidents(series([100, 300, 100, 100, 100]))).toEqual([]);
  });

  it('a spike still running at the end of the data has end null', () => {
    const w = detectIncidents(series([100, 200, 260]));
    expect(w).toHaveLength(1);
    expect(w[0]!.end).toBeNull();
  });

  it('needs PM2.5 of at least 90 and the larger of 1.5x or +60 over baseline', () => {
    // baseline 40: 1.5x = 60, +60 = 100, floor 90 -> needs 100
    expect(spikeHours(series([95, 95, 95], 's1', 40)).size).toBe(0);
    expect(spikeHours(series([100, 100], 's1', 40)).size).toBe(2);
  });

  it('falls back to the previous 24 hours when fewer than 3 days of history exist', () => {
    const short = [...Array.from({ length: 30 }, (_, h) => r('s1', h, 50)), r('s1', 30, 120), r('s1', 31, 130)];
    expect(spikeHours(short).size).toBe(2);
  });
});

describe('A2.2 computeFeatures', () => {
  // Station at Delhi centre; window hours 192..195 (start at(192), end at(196))
  const station = { id: 's1', lat: 28.61, lon: 77.21 };
  const target = [
    ...Array.from({ length: 192 }, (_, h) => r('s1', h, 100, { pm10: 200, co: 1.0, no2: 40 })),
    ...[0, 1, 2, 3].map((i) => r('s1', 192 + i, 300, { pm10: 400, co: 1.6, no2: 60 })),
  ];
  const others = ['s2', 's3', 's4'].map((id) => Array.from({ length: 196 }, (_, h) => r(id, h, 100)));
  const readingsByStation = new Map<string, Reading[]>([['s1', target], ...others.map((o) => [o[0]!.stationId, o] as [string, Reading[]])]);
  readingsByStation.set('s5', [r('s5', 10, 100)]); // no data in the window: not counted
  const spikeHoursByStation = new Map<string, Set<number>>([
    ['s1', new Set([192, 193, 194, 195].map((h) => Date.parse(at(h))))],
    ['s2', new Set([Date.parse(at(193))])],
  ]);
  const weather: Weather[] = [0, 1, 2, 3].map((i) => ({ ts: at(192 + i), windSpeed: [1, 2, 3, 2][i]!, windDir: [350, 10, 350, 10][i]!, blh: [200, 300, null, 400][i]!, precip: 0 }));
  // Fires due north-west of Delhi (Punjab), ~250 km, and one due east, and one too close
  const fires: Fire[] = [
    { lat: 30.7, lon: 76.7, acquiredAt: at(180), frp: 10, confidence: 'n' },  // NNW ~240 km, within 35° of 0°
    { lat: 30.9, lon: 76.0, acquiredAt: at(190), frp: 10, confidence: 'n' },  // NW ~280 km, bearing ~335°, within 35°
    { lat: 28.6, lon: 79.5, acquiredAt: at(190), frp: 10, confidence: 'n' },  // east: wrong sector
    { lat: 28.8, lon: 77.2, acquiredAt: at(190), frp: 10, confidence: 'n' },  // 21 km: too close
    { lat: 30.7, lon: 76.7, acquiredAt: at(100), frp: 10, confidence: 'n' },  // more than 48 h before the peak
  ];
  const res = computeFeatures({
    window: { start: at(192), end: at(196), peakAt: at(193) }, station, readings: target,
    spikeHoursByStation, readingsByStation, weather, fires, now: at(200),
  });

  it('pmRatio = mean PM2.5 / mean PM10 in the window', () => expect(res.features.pmRatio).toBe(0.75));
  it('coRise and no2Rise against the 7-day median', () => {
    expect(res.features.coRise).toBe(1.6);
    expect(res.features.no2Rise).toBe(1.5);
  });
  it('spatialShare counts stations with data in the window, target included', () => {
    expect(res.stationsWithData).toBe(4);
    expect(res.spikedStations).toBe(2);
    expect(res.features.spatialShare).toBe(0.5);
  });
  it('windSpeed is the mean; windDir is the circular mean (350 and 10 average to 0)', () => {
    expect(res.features.windSpeed).toBe(2);
    expect(res.features.windDir === 0 || res.features.windDir === 360).toBe(true);
  });
  it('blh is the mean of the non-null hours', () => expect(res.features.blh).toBe(300));
  it('upwindFires counts only fires 50-450 km away, in the wind-from sector, in the previous 48 hours', () => {
    expect(res.features.upwindFires).toBe(2);
  });
  it('hourBand uses the peak hour in India time', () => {
    expect(res.features.hourBand).toBe(hourBandAt(at(193)));
    expect(hourBandAt('2026-11-01T17:00:00Z')).toBe('night');        // 22:30 IST
    expect(hourBandAt('2026-11-01T02:30:00Z')).toBe('morning_rush'); // 08:00 IST
    expect(hourBandAt('2026-11-01T12:30:00Z')).toBe('evening_rush'); // 18:00 IST
    expect(hourBandAt('2026-11-01T07:30:00Z')).toBe('day');          // 13:00 IST
    expect(hourBandAt('2026-11-01T21:00:00Z')).toBe('night');        // 02:30 IST
  });
  it('geometry helpers', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(Math.round(circularMeanDeg([350, 10])! % 360)).toBe(0);
    expect(Math.round(haversineKm(28.61, 77.21, 30.7, 76.7))).toBeGreaterThan(200);
    expect(Math.round(bearingDeg(28.61, 77.21, 29.61, 77.21))).toBe(0);
  });
  it('missing inputs stay null, not zero', () => {
    const bare = computeFeatures({
      window: { start: at(192), end: at(196), peakAt: at(193) }, station,
      readings: target.map((x) => ({ ...x, co: null, pm10: null })), spikeHoursByStation, readingsByStation, weather: [], fires, now: at(200),
    });
    expect(bare.features.coRise).toBeNull();
    expect(bare.features.pmRatio).toBeNull();
    expect(bare.features.windSpeed).toBeNull();
    expect(bare.features.blh).toBeNull();
    expect(bare.features.upwindFires).toBe(0);
  });
});

describe('A2.3 scoreCauses scenarios', () => {
  const base: Features = { pmRatio: null, coRise: null, no2Rise: null, spatialShare: 0, windSpeed: null, windDir: null, blh: null, upwindFires: 0, hourBand: 'day' };
  const f = (o: Partial<Features>): Features => ({ ...base, ...o });

  it('night bonfire: local_burning, medium or high', () => {
    const s = scoreCauses(f({ pmRatio: 0.7, coRise: 1.6, no2Rise: 1.0, spatialShare: 1 / 14, windSpeed: 1.0, upwindFires: 0, hourBand: 'night' }));
    expect(s.topCause).toBe('local_burning');
    expect(['medium', 'high']).toContain(s.confidence);
  });
  it('farm smoke: regional_smoke, high', () => {
    const s = scoreCauses(f({ pmRatio: 0.65, coRise: 1.1, no2Rise: 1.0, spatialShare: 12 / 14, windSpeed: 2.5, windDir: 300, blh: 600, upwindFires: 200 }));
    expect(s.topCause).toBe('regional_smoke');
    expect(s.confidence).toBe('high');
  });
  it('dust: dust, medium or high', () => {
    const s = scoreCauses(f({ pmRatio: 0.3, coRise: 1.0, no2Rise: 1.0, spatialShare: 2 / 14, windSpeed: 5, upwindFires: 0, hourBand: 'day' }));
    expect(s.topCause).toBe('dust');
    expect(['medium', 'high']).toContain(s.confidence);
  });
  it('rush hour: traffic, high', () => {
    const s = scoreCauses(f({ pmRatio: 0.55, coRise: 1.3, no2Rise: 1.8, spatialShare: 3 / 14, windSpeed: 2, upwindFires: 0, hourBand: 'morning_rush' }));
    expect(s.topCause).toBe('traffic');
    expect(s.confidence).toBe('high');
  });
  it('still night: trapped_air, high', () => {
    const s = scoreCauses(f({ pmRatio: 0.6, coRise: 1.1, no2Rise: 1.1, spatialShare: 11 / 14, windSpeed: 0.8, windDir: 200, blh: 200, upwindFires: 5, hourBand: 'night' }));
    expect(s.topCause).toBe('trapped_air');
    expect(s.confidence).toBe('high');
  });
  it('ambiguous: low confidence, two close candidates', () => {
    const s = scoreCauses(f({ pmRatio: 0.5, coRise: 1.3, no2Rise: 1.0, spatialShare: 0.5, windSpeed: 1.0, upwindFires: 20, hourBand: 'night' }));
    expect(s.confidence).toBe('low');
    expect(Math.abs(s.scores[s.topCause] - s.scores[s.runnerUp])).toBeLessThanOrEqual(10);
  });
  it('a null input never fires a rule and adds no chip', () => {
    const s = scoreCauses(f({ hourBand: 'day' }));
    expect(s.evidence.every((c) => !['co_rise', 'pm_ratio_coarse', 'wind_calm'].includes(c.key))).toBe(true);
  });
  it('every chip says "supports" and carries a label with its value', () => {
    const s = scoreCauses(f({ pmRatio: 0.3, coRise: 1.0, spatialShare: 0.1, windSpeed: 5, hourBand: 'day' }), undefined, { spikedStations: 2, stationsWithData: 14 });
    expect(s.evidence.find((c) => c.key === 'few_areas')?.label).toBe('Only 2 of 14 areas spiked');
    expect(s.evidence.every((c) => c.effect === 'supports' && c.label.length > 0)).toBe(true);
  });
});
