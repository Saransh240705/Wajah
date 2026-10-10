import { describe, expect, it } from 'vitest';
import type { Cause, Incident, IncidentStatus } from '@wajah/shared';
import { cancel, finish, issue, start, WorkOrderError } from '../src/modules/workorders/workorders';

const NOW = '2026-11-03T12:00:00.000Z';
const LATER = '2026-11-03T12:30:00.000Z';
const DONE = '2026-11-03T13:15:00.000Z';

function incident(topCause: Cause = 'dust', status: IncidentStatus = 'open'): Incident {
  return {
    id: 'replay-anand-vihar-2026110310', dataset: 'replay', stationId: 'anand-vihar', area: 'Anand Vihar',
    start: '2026-11-03T10:00:00.000Z', end: null, peakPm25: 150, peakPm10: 480, peakAt: '2026-11-03T11:00:00.000Z', baselinePm25: 60,
    features: { pmRatio: 0.31, coRise: 1, no2Rise: 1, spatialShare: 0.1, windSpeed: 5, windDir: 290, blh: null, upwindFires: 2, hourBand: 'day' },
    scores: { local_burning: 0, dust: 100, traffic: 0, regional_smoke: 0, trapped_air: 0 }, topCause, confidence: 'high', evidence: [],
    status, recurrenceCount: 0, escalationLevel: 0, workOrders: [], checks: [], createdAt: NOW, updatedAt: NOW,
  };
}

const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof WorkOrderError ? e.code : String(e); }
  return 'no error';
};

describe('issue', () => {
  it('defaults to the playbook first action, numbers the order, and dispatches the incident', () => {
    const { incident: inc, workOrder } = issue(incident(), { now: NOW });
    expect(workOrder.id).toBe('replay-anand-vihar-2026110310-w1');
    expect(workOrder.actionType).toBe('water_sprinkling');
    expect(workOrder.agency).toBe('PWD');
    expect(workOrder.status).toBe('issued');
    expect(workOrder.issuedAt).toBe(NOW);
    expect(workOrder.reason).toContain('Dust is the likely cause.');
    expect(workOrder.instructionsEn).toContain('Anand Vihar');
    expect(workOrder.instructionsHi).toContain('छिड़काव');
    expect(inc.status).toBe('dispatched');
    expect(inc.workOrders).toHaveLength(1);
    expect(issue(inc, { now: LATER }).workOrder.id).toBe('replay-anand-vihar-2026110310-w2');
  });

  it('does not mutate its input', () => {
    const before = incident();
    issue(before, { now: NOW });
    expect(before.workOrders).toHaveLength(0);
    expect(before.status).toBe('open');
  });

  it('uses the recommendation function when given, and copies its reason', () => {
    const { workOrder } = issue(incident(), {
      now: NOW,
      recommend: () => ({ actionType: 'mechanical_sweeping', agency: 'MCD', reason: 'Dust is the likely cause. Sprinkling here had no effect 2 of 2 times.' }),
    });
    expect(workOrder.actionType).toBe('mechanical_sweeping');
    expect(workOrder.reason).toBe('Dust is the likely cause. Sprinkling here had no effect 2 of 2 times.');
  });

  it('accepts an explicit action and agency', () => {
    const { workOrder } = issue(incident(), { now: NOW, actionType: 'construction_inspection', agency: 'DPCC' });
    expect(workOrder.actionType).toBe('construction_inspection');
    expect(workOrder.agency).toBe('DPCC');
  });

  it('throws action_not_allowed for a local action on farm smoke or trapped air', () => {
    expect(code(() => issue(incident('regional_smoke'), { now: NOW, actionType: 'water_sprinkling' }))).toBe('action_not_allowed');
    expect(code(() => issue(incident('trapped_air'), { now: NOW, actionType: 'anti_burning_patrol' }))).toBe('action_not_allowed');
  });

  it('creates a public advisory as done at once, with nothing to measure', () => {
    const { workOrder, incident: inc } = issue(incident('regional_smoke'), { now: NOW });
    expect(workOrder.actionType).toBe('public_advisory');
    expect(workOrder.agency).toBe('Residents');
    expect(workOrder.status).toBe('done');
    expect(workOrder.doneAt).toBe(NOW);
    expect(inc.status).toBe('dispatched');
  });

  it('raises the escalation level on a recurred incident and switches to the alternative', () => {
    const first = issue(incident(), { now: NOW }).incident;
    const recurred: Incident = { ...first, status: 'recurred' };
    const { workOrder, incident: inc } = issue(recurred, { now: LATER });
    expect(workOrder.escalationLevel).toBe(1);
    expect(inc.escalationLevel).toBe(1);
    expect(workOrder.actionType).toBe('mechanical_sweeping');
    expect(workOrder.agency).toBe('MCD');
  });

  it('throws invalid_state on a cleared incident', () => {
    expect(code(() => issue(incident('dust', 'cleared'), { now: NOW }))).toBe('invalid_state');
  });

  it('marks demo orders', () => {
    expect(issue(incident(), { now: NOW, demo: true }).workOrder.demo).toBe(true);
  });
});

describe('start and finish', () => {
  const issued = () => issue(incident(), { now: NOW });

  it('start moves issued to in_progress and sets startedAt', () => {
    const { incident: inc, workOrder } = issued();
    const r = start(inc, workOrder.id, LATER);
    expect(r.workOrder.status).toBe('in_progress');
    expect(r.workOrder.startedAt).toBe(LATER);
    expect(r.incident.workOrders[0]!.status).toBe('in_progress');
  });

  it('finish sets doneAt, and startedAt too if never started', () => {
    const { incident: inc, workOrder } = issued();
    const r = finish(inc, workOrder.id, DONE);
    expect(r.workOrder.status).toBe('done');
    expect(r.workOrder.doneAt).toBe(DONE);
    expect(r.workOrder.startedAt).toBe(DONE);
  });

  it('finish keeps an earlier startedAt', () => {
    const { incident: inc, workOrder } = issued();
    const s = start(inc, workOrder.id, LATER);
    const r = finish(s.incident, workOrder.id, DONE, { key: 'photos/x.jpg', result: 'pass', note: 'A tanker.' });
    expect(r.workOrder.startedAt).toBe(LATER);
    expect(r.workOrder.photo?.result).toBe('pass');
  });

  it('starting an order that is not issued throws invalid_state', () => {
    const { incident: inc, workOrder } = issued();
    const s = start(inc, workOrder.id, LATER);
    expect(code(() => start(s.incident, workOrder.id, DONE))).toBe('invalid_state');
    const d = finish(s.incident, workOrder.id, DONE);
    expect(code(() => start(d.incident, workOrder.id, DONE))).toBe('invalid_state');
  });

  it('finishing a cancelled order throws invalid_state', () => {
    const { incident: inc, workOrder } = issued();
    const c = cancel(inc, workOrder.id, LATER);
    expect(c.workOrder.status).toBe('cancelled');
    expect(code(() => finish(c.incident, workOrder.id, DONE))).toBe('invalid_state');
  });

  it('finishing twice is a no-op that keeps the first doneAt', () => {
    const { incident: inc, workOrder } = issued();
    const d = finish(inc, workOrder.id, DONE);
    const again = finish(d.incident, workOrder.id, '2026-11-03T15:00:00.000Z');
    expect(again.workOrder.doneAt).toBe(DONE);
  });

  it('an unknown work order id throws not_found', () => {
    expect(code(() => start(incident(), 'nope-w9', NOW))).toBe('not_found');
  });
});
