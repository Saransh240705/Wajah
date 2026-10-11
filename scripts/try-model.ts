// A4.1 check: npx tsx --env-file=api/.env scripts/try-model.ts
import { Agent } from '@strands-agents/sdk';
import { getModel } from '../api/src/modules/agent/model';

const agent = new Agent({ model: await getModel(), printer: false });
console.log((await agent.invoke('In one sentence, what does PM2.5 measure?')).toString().trim());
