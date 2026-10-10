import { MemoryStore } from './memory';
import type { Store } from './types';

export * from './types';
export { MemoryStore } from './memory';

let store: Store | undefined;

/** STORE=memory (default) uses MemoryStore, persisted to STORE_FILE if set. STORE=dynamo uses DynamoDB. */
export async function getStore(): Promise<Store> {
  if (store) return store;
  if (process.env.STORE === 'dynamo') {
    const { DynamoStore } = await import('./dynamo');
    store = new DynamoStore();
  } else {
    store = new MemoryStore({ file: process.env.STORE_FILE || undefined });
  }
  return store;
}

/** For tests and scripts that bring their own store. */
export function setStore(s: Store) {
  store = s;
}
