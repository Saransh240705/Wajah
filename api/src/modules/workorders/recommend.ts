import type { Dataset, Incident } from '@wajah/shared';
import { datasetNow } from '../../lib/clock';
import type { Store } from '../../store';
import { buildLedger } from '../board/ledger';
import { recommend } from '../board/recommend';
import type { RecommendFn } from './workorders';

export async function getRecommender(store: Store, dataset: Dataset): Promise<RecommendFn | undefined> {
  const incidents = await store.listIncidents({ dataset });
  const now = await datasetNow(store, dataset);
  const ledger = buildLedger(incidents, { days: 14, now });
  return (incident: Incident) => recommend(incident, ledger.rows);
}
