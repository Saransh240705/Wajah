import { Hono } from 'hono';
import { config, pm25Band, type Incident, type StationSummary } from '@wajah/shared';
import type { AppEnv } from '../lib/env';
import { intParam, notFound } from '../lib/http';
import { STATIONS, stationById } from '../lib/stations';

const H = 3600_000;
/**
 * Active now: not cleared, and ended (or, if still running, last read) within the board's window of the dataset's
 * clock. A "running" incident at a station whose readings stopped days ago is not active.
 */
export const isActive = (i: Incident, now: string, lastReadingTs?: string | null) => {
  const effectiveEnd = i.end ?? lastReadingTs ?? i.peakAt;
  return i.status !== 'cleared' && Date.parse(effectiveEnd) >= Date.parse(now) - config.board.activeHours * H;
};

export const stations = new Hono<AppEnv>()
  .get('/stations', async (c) => {
    const { store, dataset, now } = c.var;
    const [latest, incidents] = await Promise.all([store.getLatestReadings(dataset), store.listIncidents({ dataset })]);
    const body: StationSummary[] = STATIONS.map((s) => {
      const r = latest.find((x) => x.stationId === s.id) ?? null;
      return { ...s, latest: r, band: pm25Band(r?.pm25), openIncidentId: incidents.find((i) => i.stationId === s.id && isActive(i, now, r?.ts))?.id ?? null };
    });
    return c.json(body);
  })
  .get('/stations/:id/readings', async (c) => {
    const { store, dataset, now } = c.var;
    const station = stationById(c.req.param('id'));
    if (!station) throw notFound('Station');
    const from = new Date(Date.parse(now) - intParam(c.req.query('hours'), 48, 24 * 31) * H).toISOString();
    const [readings, weather, incidents] = await Promise.all([
      store.getReadings(dataset, station.id, from, now),
      store.getWeather(dataset, from, now),
      store.listIncidents({ dataset, stationId: station.id, sinceIso: from }),
    ]);
    return c.json({ station, readings, weather, incidents });
  });
