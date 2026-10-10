// A6.2: npx tsx --env-file=api/.env scripts/seed-replay.ts --from 2025-10-29 --to 2025-11-12 --dataset replay [--detect-only]
// Replay "now" becomes the end of the last hour loaded.
import { arg, loadPeriod } from './lib/pipeline';

const from = new Date(arg('--from') ?? '2025-10-29').toISOString();
const to = new Date(arg('--to') ?? '2025-11-12').toISOString();
await loadPeriod((arg('--dataset') ?? 'replay') as 'live' | 'replay', from, to, { skipFetch: process.argv.includes('--detect-only') });
