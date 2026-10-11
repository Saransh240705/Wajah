import { describe, expect, it } from 'vitest';
import type { Incident, LedgerRow, WorkOrder } from '@wajah/shared';
import { buildBoard, buildLedger, recommend } from '../src/modules/board';

function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'test-incident-1',
    dataset: 'live',
    stationId: 'anand-vihar',
    area: 'Anand Vihar',
    start: '2026-10-10T12:00:00.000Z',
    end: null,
    peakPm25: 250,
    peakPm10: 480,
    peakAt: '2026-10-10T14:00:00.000Z',
    baselinePm25: 100,
    features: {
      pmRatio: 0.35,
      coRise: 1.0,
      no2Rise: 1.0,
      spatialShare: 0.1,
      windSpeed: 4.5,
      windDir: 290,
      blh: 500,
      upwindFires: 5,
      hourBand: 'day',
    },
    scores: {
      dust: 80,
      local_burning: 10,
      traffic: 20,
      regional_smoke: 10,
      trapped_air: 10,
    },
    topCause: 'dust',
    confidence: 'high',
    evidence: [],
    status: 'open',
    recurrenceCount: 0,
    escalationLevel: 0,
    workOrders: [],
    checks: [],
    createdAt: '2026-10-10T12:00:00.000Z',
    updatedAt: '2026-10-10T14:00:00.000Z',
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'test-incident-1-w1',
    incidentId: 'test-incident-1',
    stationId: 'anand-vihar',
    area: 'Anand Vihar',
    actionType: 'water_sprinkling',
    agency: 'PWD',
    status: 'done',
    reason: 'Dust is the likely cause.',
    instructionsEn: 'Sprinkle water',
    instructionsHi: 'छिड़काव करें',
    escalationLevel: 0,
    issuedAt: '2026-10-10T12:30:00.000Z',
    startedAt: '2026-10-10T12:45:00.000Z',
    doneAt: '2026-10-10T13:30:00.000Z',
    ...overrides,
  };
}

describe('Board and Ledger Module', () => {
  it('1. Two actionable incidents with ratios 2.5 and 1.8, same confidence -> The 2.5 incident ranks first', () => {
    const inc1 = makeIncident({ id: 'inc-1', peakPm25: 250, baselinePm25: 100 }); // ratio 2.5
    const inc2 = makeIncident({ id: 'inc-2', peakPm25: 180, baselinePm25: 100 }); // ratio 1.8
    const ledger = buildLedger([], { now: '2026-10-10T15:00:00.000Z' });
    const b = buildBoard([inc2, inc1], ledger, '2026-10-10T15:00:00.000Z');

    expect(b.items).toHaveLength(2);
    expect(b.items[0]!.incident.id).toBe('inc-1');
    expect(b.items[1]!.incident.id).toBe('inc-2');
  });

  it('2. A farm-smoke incident with the largest ratio -> It ranks last, with localActionPossible false', () => {
    const incActionable = makeIncident({ id: 'inc-act', peakPm25: 200, baselinePm25: 100, topCause: 'dust' }); // ratio 2.0
    const incFarmSmoke = makeIncident({
      id: 'inc-smoke',
      peakPm25: 450,
      baselinePm25: 100,
      topCause: 'regional_smoke',
      confidence: 'high',
    }); // ratio 4.5

    const ledger = buildLedger([], { now: '2026-10-10T15:00:00.000Z' });
    const b = buildBoard([incFarmSmoke, incActionable], ledger, '2026-10-10T15:00:00.000Z');

    expect(b.items).toHaveLength(2);
    expect(b.items[0]!.incident.id).toBe('inc-act');
    expect(b.items[0]!.localActionPossible).toBe(true);

    expect(b.items[1]!.incident.id).toBe('inc-smoke');
    expect(b.items[1]!.localActionPossible).toBe(false);
  });

  it('3. Dust at a station where sprinkling has 2 no-effect results -> Recommends mechanical sweeping, with the "had no effect" sentence', () => {
    const inc = makeIncident({ stationId: 'mundka', topCause: 'dust' });
    const ledgerRows: LedgerRow[] = [
      {
        stationId: 'mundka',
        area: 'Mundka',
        actionType: 'water_sprinkling',
        tried: 2,
        worked: 0,
        noEffect: 2,
        inconclusive: 0,
        avgNetChangePct: -2,
        illustrative: false,
      },
    ];

    const rec = recommend(inc, ledgerRows);
    expect(rec.actionType).toBe('mechanical_sweeping');
    expect(rec.agency).toBe('MCD');
    expect(rec.reason).toContain('had no effect here 2 times. Try mechanical sweeping.');
  });

  it('4. Four measured sprinkling orders: 3 worked at −20, −18, −19 and 1 no effect at −3 -> tried 4, worked 3, noEffect 1, average −15', () => {
    const wos: WorkOrder[] = [
      makeWorkOrder({ id: 'w1', effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 300, changePct: -25, expectedChangePct: -5, cityChangePct: 0, netChangePct: -20, verdict: 'worked', measuredAt: '2026-10-10T14:00:00.000Z' } }),
      makeWorkOrder({ id: 'w2', effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 300, changePct: -23, expectedChangePct: -5, cityChangePct: 0, netChangePct: -18, verdict: 'worked', measuredAt: '2026-10-10T14:00:00.000Z' } }),
      makeWorkOrder({ id: 'w3', effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 300, changePct: -24, expectedChangePct: -5, cityChangePct: 0, netChangePct: -19, verdict: 'worked', measuredAt: '2026-10-10T14:00:00.000Z' } }),
      makeWorkOrder({ id: 'w4', effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 380, changePct: -8, expectedChangePct: -5, cityChangePct: 0, netChangePct: -3, verdict: 'no_effect', measuredAt: '2026-10-10T14:00:00.000Z' } }),
    ];
    const inc = makeIncident({ workOrders: wos });
    const ledger = buildLedger([inc], { now: '2026-10-10T15:00:00.000Z' });

    expect(ledger.rows).toHaveLength(1);
    const row = ledger.rows[0]!;
    expect(row.tried).toBe(4);
    expect(row.worked).toBe(3);
    expect(row.noEffect).toBe(1);
    expect(row.inconclusive).toBe(0);
    expect(row.avgNetChangePct).toBe(-15);
  });

  it('5. A row built only from demo work orders, and one public advisory -> The row is illustrative; the advisory appears nowhere', () => {
    const wos: WorkOrder[] = [
      makeWorkOrder({
        id: 'w-demo-1',
        demo: true,
        actionType: 'construction_inspection',
        effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 350, changePct: -12, expectedChangePct: -5, cityChangePct: 0, netChangePct: -7, verdict: 'worked', measuredAt: '2026-10-10T14:00:00.000Z' },
      }),
      makeWorkOrder({
        id: 'w-adv-1',
        actionType: 'public_advisory',
      }),
    ];
    const inc = makeIncident({ workOrders: wos });
    const ledger = buildLedger([inc], { now: '2026-10-10T15:00:00.000Z' });

    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]!.actionType).toBe('construction_inspection');
    expect(ledger.rows[0]!.illustrative).toBe(true);
    expect(ledger.rows.some((r) => r.actionType === 'public_advisory')).toBe(false);
  });

  it('6. An inconclusive result only -> Counts as tried in the ledger, but not as a judged result for switching the recommendation', () => {
    const wos: WorkOrder[] = [
      makeWorkOrder({
        id: 'w-inconclusive-1',
        actionType: 'water_sprinkling',
        effect: { pollutant: 'pm10', beforeMean: 400, afterMean: 350, changePct: -12, expectedChangePct: -5, cityChangePct: 30, netChangePct: 0, verdict: 'inconclusive', note: 'city-wide shift', measuredAt: '2026-10-10T14:00:00.000Z' },
      }),
    ];
    const inc = makeIncident({ stationId: 'rohini', topCause: 'dust', workOrders: wos });
    const ledger = buildLedger([inc], { now: '2026-10-10T15:00:00.000Z' });

    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]!.tried).toBe(1);
    expect(ledger.rows[0]!.worked).toBe(0);
    expect(ledger.rows[0]!.noEffect).toBe(0);
    expect(ledger.rows[0]!.inconclusive).toBe(1);
    expect(ledger.rows[0]!.avgNetChangePct).toBeNull();

    // Recommendation should still recommend water sprinkling since inconclusive is not judged
    const rec = recommend(inc, ledger.rows);
    expect(rec.actionType).toBe('water_sprinkling');
  });
});
