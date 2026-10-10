import type { Dataset } from '@wajah/shared';
import type { Store } from '../../store';
import type { RecommendFn } from './workorders';

/**
 * The work order default action comes from the board module's `recommend` (Track B), which also writes the
 * reason sentence from the ledger. Until it is merged, return undefined so `issue` uses the playbook fallback.
 * TODO(track-b): once api/src/modules/board exports `recommend`, import it here and adapt it to RecommendFn,
 * passing the dataset's incidents or ledger as it needs.
 */
export async function getRecommender(_store: Store, _dataset: Dataset): Promise<RecommendFn | undefined> {
  return undefined;
}
