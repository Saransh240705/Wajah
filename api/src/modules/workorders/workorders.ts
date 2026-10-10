// Work order lifecycle, master PRD 4.6 and track A section 5. Pure: each function takes an incident and returns a new one.
import {
  ACTIONS, PLAYBOOKS, allowedActions, defaultAgency,
  type ActionType, type Agency, type EffectResult, type Incident, type PhotoCheck, type WorkOrder,
} from '@wajah/shared';
import { buildInstructions } from './instructions';

export type WorkOrderErrorCode = 'not_found' | 'invalid_state' | 'action_not_allowed';
const STATUS: Record<WorkOrderErrorCode, number> = { not_found: 404, invalid_state: 409, action_not_allowed: 400 };

export class WorkOrderError extends Error {
  readonly status: number;
  constructor(readonly code: WorkOrderErrorCode, message: string) {
    super(message);
    this.status = STATUS[code];
  }
}

export interface Recommendation { actionType: ActionType; agency: Agency; reason: string }
/** Same shape as the board module's `recommend` (Track B). */
export type RecommendFn = (incident: Incident) => Recommendation;

/**
 * Used until the board module's `recommend` is available: the playbook's first action, or on a recurred
 * incident the step after the last one tried. No ledger history, so the reason names only the cause.
 */
export function fallbackRecommend(incident: Incident): Recommendation {
  const pb = PLAYBOOKS[incident.topCause];
  let step = pb.steps[0]!;
  const last = incident.workOrders.filter((w) => w.status !== 'cancelled').at(-1);
  if (incident.status === 'recurred' && last) {
    const i = pb.steps.findIndex((s) => s.actionType === last.actionType && s.agency === last.agency);
    if (i >= 0 && i + 1 < pb.steps.length) step = pb.steps[i + 1]!;
  }
  const reason = pb.localActionPossible ? pb.likelyEn : `${pb.likelyEn} ${pb.doNotEn ?? ''}`.trim();
  return { actionType: step.actionType, agency: step.agency, reason };
}

export interface IssueOptions {
  now: string;
  actionType?: ActionType;
  agency?: Agency;
  recommend?: RecommendFn;
  demo?: boolean;
  /** Usual PM10 at the station, so dust instructions can say "about N times the usual level". */
  usualPm10?: number | null;
}

export function issue(incident: Incident, opts: IssueOptions): { incident: Incident; workOrder: WorkOrder } {
  if (incident.status === 'cleared') throw new WorkOrderError('invalid_state', 'This incident is cleared.');
  const rec = (opts.recommend ?? fallbackRecommend)(incident);
  const actionType = opts.actionType ?? rec.actionType;
  if (!allowedActions(incident.topCause).includes(actionType)) {
    throw new WorkOrderError('action_not_allowed', `${ACTIONS[actionType].labelEn} does not help with ${PLAYBOOKS[incident.topCause].labelEn.toLowerCase()}. Only a public advisory is allowed.`);
  }
  const agency = opts.agency ?? (actionType === rec.actionType ? rec.agency : defaultAgency(incident.topCause, actionType));
  const reason = actionType === rec.actionType ? rec.reason : PLAYBOOKS[incident.topCause].likelyEn;

  const last = incident.workOrders.at(-1);
  const escalationLevel = incident.status === 'recurred'
    ? Math.max(last?.escalationLevel ?? 0, incident.escalationLevel) + 1
    : incident.escalationLevel;

  const ins = buildInstructions(incident, actionType, agency, { usualPm10: opts.usualPm10 });
  const advisory = !ACTIONS[actionType].measurable;
  const workOrder: WorkOrder = {
    id: `${incident.id}-w${incident.workOrders.length + 1}`,
    incidentId: incident.id,
    stationId: incident.stationId,
    area: incident.area,
    actionType,
    agency,
    status: advisory ? 'done' : 'issued',
    reason,
    instructionsEn: ins.en,
    instructionsHi: ins.hi,
    escalationLevel,
    issuedAt: opts.now,
    ...(advisory ? { doneAt: opts.now } : {}),
    ...(opts.demo ? { demo: true } : {}),
  };
  return {
    incident: {
      ...incident,
      status: 'dispatched',
      escalationLevel,
      workOrders: [...incident.workOrders, workOrder],
      updatedAt: opts.now,
    },
    workOrder,
  };
}

/** Incident id from a work order id: strip the `-w{n}` suffix. */
export function incidentIdOf(workOrderId: string): string {
  return workOrderId.replace(/-w\d+$/, '');
}

function update(incident: Incident, id: string, now: string, fn: (w: WorkOrder) => WorkOrder) {
  const i = incident.workOrders.findIndex((w) => w.id === id);
  if (i < 0) throw new WorkOrderError('not_found', `Work order ${id} not found.`);
  const workOrder = fn(incident.workOrders[i]!);
  const workOrders = incident.workOrders.map((w, k) => (k === i ? workOrder : w));
  return { incident: { ...incident, workOrders, updatedAt: now }, workOrder };
}

export function findWorkOrder(incident: Incident, id: string): WorkOrder {
  const w = incident.workOrders.find((x) => x.id === id);
  if (!w) throw new WorkOrderError('not_found', `Work order ${id} not found.`);
  return w;
}

export function start(incident: Incident, id: string, now: string) {
  return update(incident, id, now, (w) => {
    if (w.status !== 'issued') throw new WorkOrderError('invalid_state', `Only an issued work order can be started; this one is ${w.status}.`);
    return { ...w, status: 'in_progress', startedAt: now };
  });
}

export function finish(incident: Incident, id: string, now: string, photo?: PhotoCheck) {
  return update(incident, id, now, (w) => {
    if (w.status === 'cancelled') throw new WorkOrderError('invalid_state', 'A cancelled work order cannot be marked done.');
    if (w.status === 'done') return photo ? { ...w, photo } : w; // idempotent; a late photo is still recorded
    return { ...w, status: 'done', startedAt: w.startedAt ?? now, doneAt: now, ...(photo ? { photo } : {}) };
  });
}

/**
 * Store a measured effect on its work order and apply the verdict (master PRD 4.7, A3.7):
 * no_effect sets the incident to recurred; worked and inconclusive leave its status as is.
 */
export function applyEffect(incident: Incident, id: string, effect: EffectResult, now: string) {
  const r = update(incident, id, now, (w) => ({ ...w, effect }));
  if (effect.verdict === 'no_effect' && r.incident.status !== 'cleared') r.incident.status = 'recurred';
  return r;
}

export function cancel(incident: Incident, id: string, now: string) {
  return update(incident, id, now, (w) => {
    if (w.status === 'done') throw new WorkOrderError('invalid_state', 'A done work order cannot be cancelled.');
    return { ...w, status: 'cancelled' };
  });
}
