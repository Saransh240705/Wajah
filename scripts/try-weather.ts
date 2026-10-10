// A1.4 check: npx tsx scripts/try-weather.ts [hours=48] [endIso]
import { fetchWeather } from '../api/src/modules/sources/openmeteo';

const hours = Number(process.argv[2] ?? 48);
const end = process.argv[3] ? new Date(process.argv[3]) : new Date();
const from = new Date(end.getTime() - hours * 3600_000).toISOString();
const rows = await fetchWeather(from, end.toISOString());
console.log(`${rows.length} hourly rows from ${rows[0]?.ts} to ${rows.at(-1)?.ts}`);
for (const r of [...rows.slice(0, 3), ...rows.slice(-3)]) {
  console.log(`${r.ts}  wind ${r.windSpeed.toFixed(2)} m/s from ${r.windDir}°  blh ${r.blh ?? '-'} m  rain ${r.precip ?? '-'} mm`);
}
