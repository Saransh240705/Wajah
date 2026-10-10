// Open-Meteo weather adapter. Written against shared/fixtures/raw/openmeteo-forecast.json and openmeteo-archive.json.
import type { Weather } from '@wajah/shared';
import { fetchWithTimeout } from './http';

export const DELHI = { lat: 28.61, lon: 77.21 };
const HOURLY = 'wind_speed_10m,wind_direction_10m,boundary_layer_height,precipitation';
const D = 24 * 3600_000;
// The archive lags real time by a few days; the forecast endpoint reaches back up to 92 days.
const ARCHIVE_LAG_DAYS = 5;
const FORECAST_MAX_PAST_DAYS = 92;

export interface OpenMeteoResponse {
  hourly: {
    time: string[];                         // 'YYYY-MM-DDTHH:MM' in UTC (timezone=UTC)
    wind_speed_10m: (number | null)[];      // m/s with wind_speed_unit=ms
    wind_direction_10m: (number | null)[];  // degrees, direction the wind comes from
    boundary_layer_height?: (number | null)[];
    precipitation?: (number | null)[];      // mm in the preceding hour
  };
}

export function parseOpenMeteo(body: OpenMeteoResponse): Weather[] {
  const h = body.hourly;
  const out: Weather[] = [];
  h.time.forEach((t, i) => {
    const windSpeed = h.wind_speed_10m[i], windDir = h.wind_direction_10m[i];
    if (windSpeed == null || windDir == null) return;
    out.push({
      ts: new Date(`${t}:00Z`).toISOString(),
      windSpeed,
      windDir,
      blh: h.boundary_layer_height?.[i] ?? null,
      precip: h.precipitation?.[i] ?? null,
    });
  });
  return out;
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Hourly weather for Delhi centre between two times (inclusive), from the forecast or archive endpoint. */
export async function fetchWeather(fromIso: string, toIso: string, now: Date = new Date(), at = DELHI): Promise<Weather[]> {
  const from = Date.parse(fromIso), to = Date.parse(toIso), nowMs = now.getTime();
  const common = `latitude=${at.lat}&longitude=${at.lon}&hourly=${HOURLY}&wind_speed_unit=ms&timezone=UTC`;
  let url: string;
  if (to < nowMs - ARCHIVE_LAG_DAYS * D || from < nowMs - FORECAST_MAX_PAST_DAYS * D) {
    url = `https://archive-api.open-meteo.com/v1/archive?${common}&start_date=${ymd(from)}&end_date=${ymd(Math.min(to, nowMs - D))}`;
  } else {
    const pastDays = Math.min(FORECAST_MAX_PAST_DAYS, Math.ceil((nowMs - from) / D) + 1);
    url = `https://api.open-meteo.com/v1/forecast?${common}&past_days=${pastDays}&forecast_days=1`;
  }
  const res = await fetchWithTimeout(url, {}, 'Open-Meteo');
  return parseOpenMeteo((await res.json()) as OpenMeteoResponse).filter((w) => {
    const t = Date.parse(w.ts);
    return t >= from && t <= to;
  });
}
