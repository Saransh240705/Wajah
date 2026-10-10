import { Hono, type Context } from 'hono';
import type { Dataset } from '@wajah/shared';
import { datasetNow } from './lib/clock';
import type { AppEnv } from './lib/env';
import { errorBody, onError } from './lib/http';
import { getStore } from './store';
import { incidents } from './routes/incidents';
import { misc } from './routes/misc';
import { stations } from './routes/stations';
import { workOrders } from './routes/workorders';
// TODO(track-b): mount the board router (GET /board, GET /ledger) from ./routes/board once it is merged (A3.8).

export const notFoundRoute = (c: Context) => c.json(errorBody('not_found', `No route for ${c.req.method} ${c.req.path}.`), 404);

export function createApp() {
  const app = new Hono<AppEnv>();

  // Dataset middleware: every handler gets the store, the dataset and that dataset's "now".
  app.use('*', async (c, next) => {
    const store = await getStore();
    const dataset: Dataset = c.req.query('dataset') === 'replay' ? 'replay' : 'live';
    c.set('store', store);
    c.set('dataset', dataset);
    c.set('now', await datasetNow(store, dataset));
    await next();
  });

  app.route('/', misc);
  app.route('/', stations);
  app.route('/', incidents);
  app.route('/', workOrders);

  app.notFound(notFoundRoute);
  app.onError(onError);
  return app;
}

export const app = createApp();
