import type { AskResponse } from '@wajah/shared';

// Placeholder until A4.5: the Function URL exists and always answers 200, as /ask must.
export const handler = async (): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> => {
  const body: AskResponse = { answer: 'Ask Wajah is not available yet. Please try again later.', evidence: [], suggestedActions: [] };
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
};
