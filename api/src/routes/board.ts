import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { intParam } from '../lib/http';
import { buildBoard, buildLedger } from '../modules/board';

export const board = new Hono<AppEnv>()
  .get('/board', async (c) => {
    const { store, dataset, now } = c.var;
    const incidents = await store.listIncidents({ dataset });
    const ledger = buildLedger(incidents, { days: 14, now });
    const b = buildBoard(incidents, ledger, now);
    return c.json(b);
  })
  .get('/ledger', async (c) => {
    const { store, dataset, now } = c.var;
    const days = intParam(c.req.query('days'), 14, 90);
    const incidents = await store.listIncidents({ dataset });
    const l = buildLedger(incidents, { days, now });
    return c.json(l);
  });
