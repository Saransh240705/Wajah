// A6.1: npx tsx --env-file=api/.env scripts/backfill.ts --days 14 --dataset live [--to <iso>] [--detect-only]
import { arg, loadPeriod } from './lib/pipeline';

const days = Number(arg('--days') ?? 14);
const to = arg('--to') ?? new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString();
const from = new Date(Date.parse(to) - days * 24 * 3600_000).toISOString();
await loadPeriod((arg('--dataset') ?? 'live') as 'live' | 'replay', from, to, { skipFetch: process.argv.includes('--detect-only') });
