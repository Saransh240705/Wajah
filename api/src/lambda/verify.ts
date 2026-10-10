import { verifyAll } from '../modules/verify/service';
import { getStore } from '../store';

export const handler = async () => {
  const changed = await verifyAll(await getStore(), 'live');
  console.log(JSON.stringify({ step: 'verify', changed }));
  return { changed };
};
