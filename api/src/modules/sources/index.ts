import type { FireFetcher, ReadingSource, WeatherFetcher } from './types';
import { fetchWeather } from './openmeteo';

export type { FireFetcher, ReadingSource, WeatherFetcher } from './types';

/**
 * The readings adapter chosen by READINGS_SOURCE (openaq | cpcb). Returns null when its key is missing.
 * TODO(A1.2/A1.3): add the OpenAQ and CPCB adapters once real responses are saved in shared/fixtures/raw/.
 */
export async function getReadingSource(): Promise<ReadingSource | null> {
  const which = process.env.READINGS_SOURCE ?? 'openaq';
  if (which === 'openaq' && process.env.OPENAQ_API_KEY) {
    const m = await import('./openaq').catch(() => null);
    return m?.openaqSource ?? null;
  }
  if (which === 'cpcb' && process.env.DATA_GOV_API_KEY) {
    const m = await import('./cpcb').catch(() => null);
    return m?.cpcbSource ?? null;
  }
  return null;
}

export const weatherFetcher: WeatherFetcher = (from, to) => fetchWeather(from, to);

/** NASA FIRMS, when FIRMS_MAP_KEY is set. TODO(A1.5): add the adapter once a real CSV is saved. */
export async function getFireFetcher(): Promise<FireFetcher | null> {
  if (!process.env.FIRMS_MAP_KEY) return null;
  const m = await import('./firms').catch(() => null);
  return m?.fetchFires ?? null;
}
