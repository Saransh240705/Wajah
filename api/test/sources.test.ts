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
