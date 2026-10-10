import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOpenMeteo } from '../src/modules/sources/openmeteo';

const raw = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', '..', 'shared', 'fixtures', 'raw', name), 'utf8'));

describe('Open-Meteo adapter (real responses)', () => {
  for (const file of ['openmeteo-forecast.json', 'openmeteo-archive.json']) {
    it(`parses ${file} into hourly UTC Weather rows`, () => {
      const rows = parseOpenMeteo(raw(file));
      expect(rows.length).toBeGreaterThanOrEqual(48);
      expect(rows[0]!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/);
      expect(Date.parse(rows[1]!.ts) - Date.parse(rows[0]!.ts)).toBe(3600_000);
      for (const r of rows) {
        expect(r.windDir).toBeGreaterThanOrEqual(0);
        expect(r.windDir).toBeLessThanOrEqual(360);
        expect(r.windSpeed).toBeGreaterThanOrEqual(0);
      }
      expect(rows.some((r) => r.blh != null)).toBe(true);
      expect(rows.every((r) => r.precip != null)).toBe(true);
    });
  }
});

import { parseHours, sensorParameters, sensorsByRecency } from '../src/modules/sources/openaq';

describe('OpenAQ adapter (real responses)', () => {
  const params = sensorParameters(raw('openaq-locations-delhi.json'));
  it('maps sensor ids to pollutants from the locations response', () => {
    expect(params.get(12235610)).toBe('pm25');
    expect(params.get(384)).toBe('pm25'); // legacy sensor at the same location
  });
  it('orders each pollutant\'s sensors newest first, so legacy 2018 sensors are not used', () => {
    const by = sensorsByRecency(raw('openaq-latest-anand-vihar.json'), params);
    expect(by.get('pm25')![0]!.sensorId).toBe(12235610);
    expect(by.get('pm10')![0]!.sensorId).toBe(12235609);
    expect(by.get('co')![0]!.utc).toBe('2026-10-07T14:30:00Z');
  });
  it('parses hourly rows to the start of the UTC hour', () => {
    const rows = parseHours(raw('openaq-hours-anand-vihar-pm25-nov2025.json'));
    expect(rows.length).toBe(386);
    expect(rows[0]).toEqual({ ts: '2025-10-27T23:00:00.000Z', value: 152 });
    expect(new Set(rows.map((r) => r.ts)).size).toBe(rows.length);
  });
});

import { parseFirmsCsv } from '../src/modules/sources/firms';

describe('FIRMS adapter (real CSVs)', () => {
  const csv = (name: string) => readFileSync(join(__dirname, '..', '..', 'shared', 'fixtures', 'raw', name), 'utf8');
  it('parses the NRT CSV and pads acq_time', () => {
    const fires = parseFirmsCsv(csv('firms-viirs-snpp-nrt-2d.csv'));
    expect(fires.length).toBe(167);
    expect(fires[0]).toMatchObject({ lat: 28.14409, lon: 77.6863, acquiredAt: '2026-10-09T07:41:00.000Z', frp: 8.09, confidence: 'n' });
  });
  it('parses the SP CSV, which has an extra type column', () => {
    const fires = parseFirmsCsv(csv('firms-viirs-snpp-sp-2025-11-01.csv'));
    expect(fires.length).toBe(2745);
    expect(fires.every((f) => /^2025-11-0[1-5]T\d{2}:\d{2}:00\.000Z$/.test(f.acquiredAt))).toBe(true);
  });
});
