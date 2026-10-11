import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AskRequest } from '@wajah/shared';
import { app, notFoundRoute } from './app';
import { ask } from './modules/agent/run';
import { getStore } from './store';

// CORS only here: on AWS, API Gateway and the Function URL add the headers (track A section 7).
const origins = ['http://localhost:3000', process.env.WEB_ORIGIN].filter((o): o is string => !!o);
const local = new Hono();
local.use('*', cors({ origin: origins, allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['content-type'] }));
// On AWS /ask is served by the agent Function URL; locally it sits next to the API.
local.post('/ask', async (c) => c.json(await ask(await getStore(), (await c.req.json().catch(() => ({}))) as AskRequest)));
local.route('/', app);
local.notFound(notFoundRoute);

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: local.fetch, port }, () => {
  console.log(`Wajah API on http://localhost:${port} (STORE=${process.env.STORE ?? 'memory'}${process.env.STORE_FILE ? `, file ${process.env.STORE_FILE}` : ''})`);
});
