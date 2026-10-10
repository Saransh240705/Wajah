// Shared by backfill.ts (live) and seed-replay.ts (replay): history -> store -> detection. Re-runnable (all upserts).
import { config, type Dataset, type Station } from '@wajah/shared';
import { STATIONS } from '../../api/src/lib/stations';
import { runDetection } from '../../api/src/modules/fingerprint/diagnose';
import { groupFiresByDay } from '../../api/src/modules/ingest';
import { fetchFiresRange } from '../../api/src/modules/sources/firms';
import { OpenAQ } from '../../api/src/modules/sources/openaq';
import { fetchWeather } from '../../api/src/modules/sources/openmeteo';
import { getStore } from '../../api/src/store';

const D = 24 * 3600_000;
const iso = (ms: number) => new Date(ms).toISOString();

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export async function loadPeriod(dataset: Dataset, fromIso: string, toIso: string, opts: { skipFetch?: boolean } = {}) {
  const store = await getStore();
  // Baseline history before the period so the first days use the 7-day median, not the 24-hour fallback
  const dataFrom = iso(Date.parse(fromIso) - config.detect.baselineDays * D);
  console.log(`[${dataset}] period ${fromIso} to ${toIso} (readings from ${dataFrom}), store ${process.env.STORE ?? 'memory'}${process.env.STORE_FILE ? ` file ${process.env.STORE_FILE}` : ''}`);

  if (!opts.skipFetch) {
    const oaq = new OpenAQ();
    for (const s of STATIONS as Station[]) {
      try {
        const rows = await oaq.fetchHistory(s, dataFrom, toIso, STATIONS);
        await store.putReadings(dataset, rows);
        const inPeriod = rows.filter((r) => r.ts >= fromIso);
        const complete = (k: 'pm25' | 'pm10' | 'no2' | 'co') => inPeriod.filter((r) => r[k] != null).length;
        console.log(`  ${s.id.padEnd(13)} ${String(inPeriod.length).padStart(4)} rows in period  pm25 ${complete('pm25')} pm10 ${complete('pm10')} no2 ${complete('no2')} co ${complete('co')}`);
      } catch (e) {
        console.log(`  ${s.id.padEnd(13)} FAILED: ${(e as Error).message}`);
      }
    }
    const weather = await fetchWeather(dataFrom, toIso);
    await store.putWeather(dataset, weather);
    console.log(`  weather: ${weather.length} hourly rows (rain ${weather.filter((w) => (w.precip ?? 0) > 0).length} h, BLH ${weather.filter((w) => w.blh != null).length} h)`);
    const fires = await fetchFiresRange(iso(Date.parse(dataFrom) - 2 * D), toIso);
    for (const [day, list] of groupFiresByDay(fires)) await store.putFires(dataset, day, list);
    console.log(`  fires: ${fires.length} detections`);
  }

  const r = await runDetection(store, dataset, { now: toIso, fromIso });
  const all = (await store.listIncidents({ dataset })).filter((i) => i.start >= fromIso && i.start <= toIso);
  console.log(`  detection: ${r.created.length} created, ${r.updated.length} updated, ${r.unchanged} unchanged; ${all.length} incidents in the period`);
  const by = (k: (i: (typeof all)[number]) => string) => all.reduce<Record<string, number>>((a, i) => ((a[k(i)] = (a[k(i)] ?? 0) + 1), a), {});
  console.log(`  by cause:      ${JSON.stringify(by((i) => i.topCause))}`);
  console.log(`  by confidence: ${JSON.stringify(by((i) => i.confidence))}`);
  console.log(`  by station:    ${JSON.stringify(by((i) => i.stationId))}`);
  return all;
}
