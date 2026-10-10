// Work order workflow tasks (track A A5.5). One Step Functions execution per work order calls these; each is
// safe to run twice. Times for the deadline use the real clock (issuedAtReal), because replay work orders carry
// simulated timestamps.
import { ACTIONS, PLAYBOOKS, type Verdict } from '@wajah/shared';
import type { Store } from '../store';
import { publish } from './notify/sns';
import { loadWorkOrder, measureWorkOrder } from './workorders/service';

export type WorkflowEvent =
  | { task: 'notify'; workOrderId: string }
  | { task: 'checkDone'; workOrderId: string; slaSeconds: number; issuedAtReal?: string }
  | { task: 'escalateOverdue'; workOrderId: string }
  | { task: 'measure'; workOrderId: string }
  | { task: 'escalateNoEffect'; workOrderId: string };

const link = (id: string, dataset: string) => `${(process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/work-order/${id}?dataset=${dataset}`;

export async function runWorkflowTask(store: Store, e: WorkflowEvent, now: Date = new Date()) {
  const { incident, workOrder: w } = await loadWorkOrder(store, e.workOrderId);
  const action = ACTIONS[w.actionType].labelEn;

  switch (e.task) {
    case 'notify': {
      await publish(`Wajah work order: ${action} at ${w.area}`, [
        `${w.agency}: please carry out this work order${w.demo ? ' (DEMO, simulated)' : ''}.`,
        '', w.instructionsEn, '', `Why: ${w.reason}`, '', `Field page: ${link(w.id, incident.dataset)}`, `Work order: ${w.id}`,
      ].join('\n'));
      return { ok: true };
    }
    case 'checkDone': {
      if (w.status === 'done') return { state: 'done' };
      if (w.status === 'cancelled') return { state: 'cancelled' };
      const issued = Date.parse(e.issuedAtReal ?? w.issuedAt);
      if (!w.overdueNotified && now.getTime() - issued > e.slaSeconds * 1000) {
        const fresh = await loadWorkOrder(store, w.id); // re-read before writing
        const updated = { ...fresh.incident, workOrders: fresh.incident.workOrders.map((x) => (x.id === w.id ? { ...x, overdueNotified: true } : x)) };
        await store.putIncident(updated);
        return { state: 'overdue' };
      }
      return { state: 'waiting' };
    }
    case 'escalateOverdue': {
      await publish(`Overdue: ${action} at ${w.area}`, `Work order ${w.id} (${w.agency}) is not marked done within the deadline.\n\nField page: ${link(w.id, incident.dataset)}`);
      return { ok: true };
    }
    case 'measure': {
      const r = await measureWorkOrder(store, w.id);
      const effect = r.workOrder.effect;
      if (!effect) return { verdict: 'inconclusive' as Verdict, note: 'after window not complete yet; the hourly ingest will measure it' };
      return { verdict: effect.verdict, netChangePct: effect.netChangePct };
    }
    case 'escalateNoEffect': {
      if (incident.status !== 'recurred' && incident.status !== 'cleared') await store.putIncident({ ...incident, status: 'recurred' });
      const pb = PLAYBOOKS[incident.topCause];
      const i = pb.steps.findIndex((s) => s.actionType === w.actionType && s.agency === w.agency);
      const alt = pb.steps[i + 1];
      await publish(`No effect: ${action} at ${w.area}`, [
        `${action} by ${w.agency} at ${w.area} did not reduce pollution beyond the expected change (net ${w.effect?.netChangePct ?? '?'}%).`,
        alt ? `Recommended next: ${ACTIONS[alt.actionType].labelEn} through ${alt.agency}.` : 'No alternative action in the playbook.',
        '', `Incident: ${incident.id}`,
      ].join('\n'));
      return { ok: true };
    }
  }
}
