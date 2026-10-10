// A1.5 check: npx tsx --env-file=api/.env scripts/try-fires.ts [days=2]
import { fetchFires } from '../api/src/modules/sources/firms';

const fires = await fetchFires(Number(process.argv[2] ?? 2));
console.log(`${fires.length} detections in the last ${process.argv[2] ?? 2} days (VIIRS_SNPP_NRT, box 73,28,78,33)`);
for (const f of fires.slice(0, 3)) console.log(`${f.acquiredAt}  ${f.lat}, ${f.lon}  frp ${f.frp}  confidence ${f.confidence}`);
