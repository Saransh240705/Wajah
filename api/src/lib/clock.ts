import type { Dataset } from '@wajah/shared';
import type { Store } from '../store';

/**
 * The dataset's "now". Live: the real clock. Replay: the end of the last hour of the period (master PRD section 9).
 * Every handler takes "now" from here, never from the system clock directly.
 */
export async function datasetNow(store: Store, dataset: Dataset, real: Date = new Date()): Promise<string> {
  if (dataset === 'live') return real.toISOString();
  const latest = await store.getLatestReadings('replay');
  if (!latest.length) return real.toISOString();
  const last = latest.reduce((a, r) => (r.ts > a ? r.ts : a), latest[0]!.ts);
  return new Date(Date.parse(last) + 3600_000).toISOString();
}
