// A1.2 check: npx tsx --env-file=api/.env scripts/try-source.ts <stationId> [hours=6] [endIso]
// Prints the last N hourly rows from the configured readings source's history.
import type { Reading, Station } from '@wajah/shared';
import { getReadingSource } from '../api/src/modules/sources';
import { STATIONS, stationById } from '../api/src/lib/stations';

const id = process.argv[2] ?? 'rohini';
const hours = Number(process.argv[3] ?? 6);
const station = stationById(id);
if (!station) throw new Error(`unknown station ${id}`);
const source = await getReadingSource();
const src = source;
if (!src?.fetchHistory) throw new Error(`source ${process.env.READINGS_SOURCE ?? 'openaq'} unavailable or has no history`);
const end = process.argv[4] ? new Date(process.argv[4]) : new Date();
const from = new Date(end.getTime() - Math.max(hours, 96) * 3600_000).toISOString();
const fetchHistory = src.fetchHistory.bind(src) as (s: Station, f: string, t: string, all: Station[]) => Promise<Reading[]>;
const rows = (await fetchHistory(station, from, end.toISOString(), STATIONS)).slice(-hours);
console.log(`${src.name} ${station.name}: last ${rows.length} hourly rows`);
for (const r of rows) console.log(`${r.ts}  PM2.5 ${r.pm25 ?? '-'}  PM10 ${r.pm10 ?? '-'}  NO2 ${r.no2 ?? '-'}  CO ${r.co ?? '-'}`);
