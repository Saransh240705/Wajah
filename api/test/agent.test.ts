import { describe, expect, it } from 'vitest';
import type { Incident } from '@wajah/shared';
import { readableNames } from '../src/modules/agent/run';
import { fallbackBoard } from '../src/modules/agent/tools';

describe('agent answer clean-up', () => {
  it('replaces cause and action code names, in Hindi for Hindi answers', () => {
    expect(readableNames('The likely cause is regional_smoke; issue a public_advisory.')).toBe('The likely cause is smoke from farm fires; issue a public advisory.');
    expect(readableNames('संभावित कारण regional_smoke है')).toBe('संभावित कारण पराली के धुएँ है');
  });
  it('the stand-in board shows a city-wide event as one row', () => {
    const inc = (id: string, topCause: Incident['topCause'], peak: number): Incident => ({
      dataset: 'replay', end: null, peakPm10: null, baselinePm25: 100, features: {} as Incident['features'], scores: {} as Incident['scores'],
      confidence: 'high', evidence: [], status: 'open', recurrenceCount: 0, escalationLevel: 0, workOrders: [], checks: [], createdAt: '', updatedAt: '',
      id, stationId: id, area: id, start: '2025-11-11T17:00:00.000Z', peakAt: '2025-11-11T18:00:00.000Z', peakPm25: peak, topCause,
    });
    const rows = fallbackBoard([inc('a', 'regional_smoke', 400), inc('b', 'regional_smoke', 500), inc('c', 'regional_smoke', 450), inc('d', 'dust', 300)], '2025-11-12T00:00:00.000Z');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.area).toBe('d');
    expect(rows[1]!.area).toBe('3 areas at once, highest at b');
  });
});
