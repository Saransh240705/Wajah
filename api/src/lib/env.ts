import type { Dataset } from '@wajah/shared';
import type { Store } from '../store';

export type AppEnv = { Variables: { store: Store; dataset: Dataset; now: string } };
