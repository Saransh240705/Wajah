import { Hono } from 'hono';
import { ACTIONS, type ActionType, type Agency, type PhotoCheck } from '@wajah/shared';
import type { AppEnv } from '../lib/env';
import { HttpError } from '../lib/http';
import { checkPhoto } from '../modules/photo/check';
import { photoKey, photoUploadUrl } from '../modules/photo/upload';
import { finishWorkOrder, issueWorkOrder, loadWorkOrder, measureWorkOrder, startWorkOrder } from '../modules/workorders/service';

const AGENCIES: Agency[] = ['MCD', 'PWD', 'DPCC', 'Traffic Police', 'Residents'];

async function body(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const workOrders = new Hono<AppEnv>()
  .post('/incidents/:id/work-orders', async (c) => {
    const b = await body(c);
    const actionType = b.actionType as ActionType | undefined;
    const agency = b.agency as Agency | undefined;
    if (actionType && !(actionType in ACTIONS)) throw new HttpError(400, 'bad_request', `Unknown actionType ${actionType}.`);
    if (agency && !AGENCIES.includes(agency)) throw new HttpError(400, 'bad_request', `Unknown agency ${agency}.`);
    const r = await issueWorkOrder(c.var.store, c.req.param('id'), { actionType, agency });
    return c.json({ incident: r.incident, workOrder: r.workOrder }, 201);
  })
  .get('/work-orders/:id', async (c) => {
    const { incident, workOrder } = await loadWorkOrder(c.var.store, c.req.param('id'));
    return c.json({ workOrder, incident });
  })
  .post('/work-orders/:id/start', async (c) => {
    return c.json((await startWorkOrder(c.var.store, c.req.param('id'))).workOrder);
  })
  .post('/work-orders/:id/done', async (c) => {
    const b = await body(c);
    const key = typeof b.photoKey === 'string' && b.photoKey ? b.photoKey : undefined;
    // The photo check is shown, never enforced: the order is marked done whatever it says
    let photo: PhotoCheck | undefined;
    if (key) {
      const { workOrder } = await loadWorkOrder(c.var.store, c.req.param('id'));
      // Only this work order's own upload key: never read an arbitrary object from the bucket
      const expected = photoKey(workOrder.id);
      if (key !== expected) throw new HttpError(400, 'bad_photo_key', `photoKey must be ${expected}, as returned by /photo-url.`);
      photo = await checkPhoto(expected, workOrder.actionType, workOrder.area);
    }
    return c.json((await finishWorkOrder(c.var.store, c.req.param('id'), photo)).workOrder);
  })
  .post('/work-orders/:id/photo-url', async (c) => {
    const { workOrder } = await loadWorkOrder(c.var.store, c.req.param('id'));
    const r = await photoUploadUrl(workOrder.id);
    if (!r) throw new HttpError(503, 'photo_unavailable', 'Photo upload needs the deployed bucket (EVIDENCE_BUCKET).');
    return c.json(r);
  })
  .post('/work-orders/:id/measure', async (c) => {
    // Re-measures even if an effect exists. Before the after window is complete: unchanged, 200, no new effect.
    return c.json((await measureWorkOrder(c.var.store, c.req.param('id'), { force: true })).workOrder);
  });
