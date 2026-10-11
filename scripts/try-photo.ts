// A7.2 check: npx tsx --env-file=api/.env scripts/try-photo.ts <photo.jpg> [actionType=water_sprinkling] [area=Anand Vihar]
import { readFileSync } from 'node:fs';
import type { ActionType } from '@wajah/shared';
import { checkPhoto } from '../api/src/modules/photo/check';

const [file, action = 'water_sprinkling', area = 'Anand Vihar'] = process.argv.slice(2);
const r = await checkPhoto('photos/local-test.jpg', action as ActionType, area, readFileSync(file!));
console.log(`${file!.split('/').pop()} as ${action}: ${JSON.stringify(r)}`);
