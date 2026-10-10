import type { Fire, Reading, Station, Weather } from '@wajah/shared';

/** Readings adapters implement this, so switching OpenAQ and the CPCB feed is a config change (master PRD 8). */
export interface ReadingSource {
  name: Reading['source'];
  /** Latest hourly rows for the stations; stations that fail are logged and skipped. */
  fetchLatest(stations: Station[]): Promise<Reading[]>;
  /** Hourly history; not every source has it. */
  fetchHistory?(station: Station, fromIso: string, toIso: string): Promise<Reading[]>;
}

export type WeatherFetcher = (fromIso: string, toIso: string) => Promise<Weather[]>;
export type FireFetcher = (days: number) => Promise<Fire[]>;
