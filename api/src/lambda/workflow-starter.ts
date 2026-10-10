import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { config } from '@wajah/shared';
import { setWorkflowStarter } from '../modules/workorders/service';

/** When STATE_MACHINE_ARN is set (ApiFunction only), issuing a work order starts one execution (A5.7). */
export function configureWorkflow() {
  const arn = process.env.STATE_MACHINE_ARN;
  if (!arn) return;
  const sfn = new SFNClient({});
  setWorkflowStarter(async (workOrder, incident) => {
    const timing = incident.dataset === 'live' && !workOrder.demo ? config.workflow.live : config.workflow.demo;
    const res = await sfn.send(new StartExecutionCommand({
      stateMachineArn: arn,
      name: workOrder.id.replace(/[^A-Za-z0-9-_]/g, '_').slice(0, 80),
      input: JSON.stringify({ workOrderId: workOrder.id, ...timing }),
    }));
    return res.executionArn;
  });
}
