import { runIngest } from '../modules/ingest';
import { getStore } from '../store';

export const handler = async () => runIngest(await getStore(), 'live');
