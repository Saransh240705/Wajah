// Function URL handler for POST /ask (A4.5). Always answers 200 with a readable AskResponse.
import type { AskRequest } from '@wajah/shared';
import { ask } from '../modules/agent/run';
import { getStore } from '../store';

interface UrlEvent { body?: string; isBase64Encoded?: boolean; requestContext?: { http?: { method?: string; path?: string } } }

const reply = (body: unknown) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const handler = async (event: UrlEvent) => {
  let req: AskRequest = {};
  try {
    const raw = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : event.body ?? '{}';
    req = JSON.parse(raw) as AskRequest;
  } catch {
    return reply({ answer: 'Please send a JSON body with a message.', evidence: [], suggestedActions: [] });
  }
  return reply(await ask(await getStore(), req));
};
