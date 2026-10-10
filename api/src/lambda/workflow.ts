import { runWorkflowTask, type WorkflowEvent } from '../modules/workflow';
import { getStore } from '../store';

export const handler = async (event: WorkflowEvent) => {
  const result = await runWorkflowTask(await getStore(), event);
  console.log(JSON.stringify({ step: 'workflow', task: event.task, workOrderId: event.workOrderId, result }));
  return result;
};
