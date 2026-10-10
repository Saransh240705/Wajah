import { Hono } from 'hono';
import type { AppEnv } from '../lib/env';
import { intParam } from '../lib/http';
import { buildScoreboard } from '../modules/scoreboard';

const H = 3600_000;

export const misc = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true }))
  .get('/fires', async (c) => {
    const { store, dataset, now } = c.var;
    const from = new Date(Date.parse(now) - intParam(c.req.query('hours'), 48, 24 * 31) * H).toISOString();
    return c.json(await store.getFires(dataset, from, now));
  })
  .get('/scoreboard', async (c) => {
    const { store, dataset, now } = c.var;
    const since = new Date(Date.parse(now) - intParam(c.req.query('days'), 14, 365) * 24 * H).toISOString();
    const list = (await store.listIncidents({ dataset })).filter((i) => i.start >= since);
    return c.json(buildScoreboard(list));
  });
