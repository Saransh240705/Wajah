import { handle } from 'hono/aws-lambda';
import { app } from '../app';
import { configureWorkflow } from './workflow-starter';

configureWorkflow();
export const handler = handle(app);
