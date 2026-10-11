import { beforeEach, describe, expect, it } from 'vitest';
import type { Incident, WorkOrder } from '@wajah/shared';
import { createApp } from '../src/app';
import { setStore } from '../src/store';
import { measurePending } from '../src/modules/workorders/service';
import { buildSyntheticStore, FADE } from '../../scripts/synthetic';

let app: ReturnType<typeof createApp>;
let targetId: string;
let store: ReturnType<typeof buildSyntheticStore>['store'];

const post = (path: string, body?: unknown) => app.request(path, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

beforeEach(() => {
  const s = buildSyntheticStore();
  store = s.store;
  targetId = s.targetId;
  setStore(store);
  app = createApp();
});

describe('work order endpoints', () => {
  it('issue, start, done, measure: the incident shows the work order with an effect', async () => {
    const issued = await post(`/incidents/${targetId}/work-orders`);
    expect(issued.status).toBe(201);
    const { workOrder, incident } = (await issued.json()) as { workOrder: WorkOrder; incident: Incident };
    expect(workOrder.actionType).toBe('water_sprinkling');
    expect(incident.status).toBe('dispatched');

    const got = await app.request(`/work-orders/${workOrder.id}`);
    expect(((await got.json()) as { incident: Incident }).incident.id).toBe(targetId);

    expect(((await (await post(`/work-orders/${workOrder.id}/start`)).json()) as WorkOrder).status).toBe('in_progress');
    expect(((await (await post(`/work-orders/${workOrder.id}/done`)).json()) as WorkOrder).status).toBe('done');
    const measured = (await (await post(`/work-orders/${workOrder.id}/measure`)).json()) as WorkOrder;
    expect(measured.effect?.pollutant).toBe('pm10');
    expect(measured.effect?.verdict).toBe('worked');

    const after = (await (await app.request(`/incidents/${targetId}`)).json()) as Incident;
    expect(after.workOrders[0]!.effect?.verdict).toBe('worked');
    expect(after.status).toBe('dispatched');
  });

  it('errors: unknown ids 404, disallowed action 400, starting twice 409', async () => {
    expect((await post('/incidents/nope/work-orders')).status).toBe(404);
    expect((await app.request('/work-orders/nope-w1')).status).toBe(404);
    const advisory = await post(`/incidents/${targetId}/work-orders`, { actionType: 'public_advisory' });
    expect(advisory.status).toBe(201);
    const bad = await post(`/incidents/${targetId}/work-orders`, { actionType: 'teleport' });
    expect(bad.status).toBe(400);
    const { workOrder } = (await (await post(`/incidents/${targetId}/work-orders`)).json()) as { workOrder: WorkOrder };
    await post(`/work-orders/${workOrder.id}/start`);
    const again = await post(`/work-orders/${workOrder.id}/start`);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: { code: 'invalid_state' } });
  });

  it('action_not_allowed on farm smoke', async () => {
    const inc = (await store.getIncident(targetId))!;
    await store.putIncident({ ...inc, topCause: 'regional_smoke' });
    const r = await post(`/incidents/${targetId}/work-orders`, { actionType: 'water_sprinkling' });
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: { code: 'action_not_allowed' } });
  });

  it('measure before the job is done returns the work order unchanged with 200', async () => {
    const { workOrder } = (await (await post(`/incidents/${targetId}/work-orders`)).json()) as { workOrder: WorkOrder };
    const r = await post(`/work-orders/${workOrder.id}/measure`);
    expect(r.status).toBe(200);
    expect(((await r.json()) as WorkOrder).effect).toBeUndefined();
  });
});

describe('A3.6 ingest fallback and A3.7 verdict consequences', () => {
  it('a done work order with no effect is measured by the fallback without calling /measure', async () => {
    const { workOrder } = (await (await post(`/incidents/${targetId}/work-orders`)).json()) as { workOrder: WorkOrder };
    await post(`/work-orders/${workOrder.id}/done`);
    expect(await measurePending(store, 'replay')).toEqual([workOrder.id]);
    expect((await store.getIncident(targetId))!.workOrders[0]!.effect?.verdict).toBe('worked');
    expect(await measurePending(store, 'replay')).toEqual([]); // measured once
  });

  it('no_effect sets the incident to recurred; worked leaves it dispatched', async () => {
    const s = buildSyntheticStore({ targetPm10: FADE });
    setStore(s.store);
    app = createApp();
    const { workOrder } = (await (await post(`/incidents/${s.targetId}/work-orders`)).json()) as { workOrder: WorkOrder };
    await post(`/work-orders/${workOrder.id}/done`);
    const m = (await (await post(`/work-orders/${workOrder.id}/measure`)).json()) as WorkOrder;
    expect(m.effect?.verdict).toBe('no_effect');
    expect((await s.store.getIncident(s.targetId))!.status).toBe('recurred');
  });
});

describe('photo key validation', () => {
  it('rejects a photoKey that is not this work order\'s own upload key', async () => {
    const { workOrder } = (await (await post(`/incidents/${targetId}/work-orders`)).json()) as { workOrder: WorkOrder };
    const bad = await post(`/work-orders/${workOrder.id}/done`, { photoKey: 'evidence/some-other-incident.json' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'bad_photo_key' } });
    expect((await store.getIncident(targetId))!.workOrders[0]!.status).toBe('issued');
  });
});
