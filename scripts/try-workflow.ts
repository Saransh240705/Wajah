// A5.5 check: runs every workflow task locally with sample events on the SYNTHETIC store (no AWS needed;
// SNS messages are logged when ALERTS_TOPIC_ARN is unset). npx tsx scripts/try-workflow.ts
import { runWorkflowTask } from '../api/src/modules/workflow';
import { finishWorkOrder, issueWorkOrder } from '../api/src/modules/workorders/service';
import { buildSyntheticStore, ACTED } from './synthetic';

const { store, targetId } = buildSyntheticStore({ targetPm10: ACTED });
const { workOrder } = await issueWorkOrder(store, targetId);
const id = workOrder.id;
const real = new Date().toISOString();
const run = async (e: Parameters<typeof runWorkflowTask>[1], label: string = e.task) => console.log(label.padEnd(26), JSON.stringify(await runWorkflowTask(store, e)));

await run({ task: 'notify', workOrderId: id });
await run({ task: 'checkDone', workOrderId: id, slaSeconds: 7200, issuedAtReal: real }, 'checkDone (in time)');
await run({ task: 'checkDone', workOrderId: id, slaSeconds: 0, issuedAtReal: real }, 'checkDone (past deadline)');
await run({ task: 'checkDone', workOrderId: id, slaSeconds: 0, issuedAtReal: real }, 'checkDone (again)');
await run({ task: 'escalateOverdue', workOrderId: id });
await finishWorkOrder(store, id);
await run({ task: 'checkDone', workOrderId: id, slaSeconds: 7200, issuedAtReal: real }, 'checkDone (after done)');
await run({ task: 'measure', workOrderId: id });
await run({ task: 'measure', workOrderId: id }, 'measure (again)');
await run({ task: 'escalateNoEffect', workOrderId: id });
console.log('incident status after escalateNoEffect:', (await store.getIncident(targetId))!.status);
