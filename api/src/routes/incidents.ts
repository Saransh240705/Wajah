import { Hono } from 'hono';
import type { IncidentStatus } from '@wajah/shared';
import type { AppEnv } from '../lib/env';
import { intParam, notFound } from '../lib/http';
import { verifyIncident } from '../modules/verify/service';

const STATUSES: IncidentStatus[] = ['open', 'dispatched', 'cleared', 'recurred'];

export const incidents = new Hono<AppEnv>()
  .get('/incidents', async (c) => {
    const { store, dataset } = c.var;
    const status = c.req.query('status') as IncidentStatus | undefined;
    const list = await store.listIncidents({
      dataset,
      stationId: c.req.query('stationId') || undefined,
      status: status && STATUSES.includes(status) ? status : undefined,
    });
    return c.json(list.slice(0, intParam(c.req.query('limit'), 50, 500)));
  })
  .get('/incidents/:id', async (c) => {
    const incident = await c.var.store.getIncident(c.req.param('id'));
    if (!incident) throw notFound('Incident');
    return c.json(incident);
  })
  .post('/incidents/:id/verify', async (c) => {
    const incident = await verifyIncident(c.var.store, c.req.param('id'));
    if (!incident) throw notFound('Incident');
    return c.json(incident);
  });
