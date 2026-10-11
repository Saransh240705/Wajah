// Agent runner, track A A4.4. Evidence and suggested actions come from code, never from the model.
import { AfterToolCallEvent, Agent, BeforeToolCallEvent } from '@strands-agents/sdk';
import { ACTIONS, PLAYBOOKS, config, type AskRequest, type AskResponse, type Dataset } from '@wajah/shared';
import { datasetNow } from '../../lib/clock';
import type { Store } from '../../store';
import { getModel } from './model';
import { systemPrompt } from './prompt';
import { buildTools, type ToolCapture } from './tools';

const isHindi = (s?: string) => !!s && /[ऀ-ॿ]/.test(s);
const log = (o: Record<string, unknown>) => console.log(JSON.stringify(o));

/** The model can see code names in tool schemas; replace any that slip into the answer with readable names. */
export function readableNames(answer: string): string {
  const hi = isHindi(answer);
  let out = answer;
  for (const p of Object.values(PLAYBOOKS)) out = out.replaceAll(p.cause, hi ? p.labelHi : p.labelEn.toLowerCase());
  for (const a of Object.values(ACTIONS)) out = out.replaceAll(a.type, hi ? a.labelHi : a.labelEn.toLowerCase());
  return out;
}

function apology(req: AskRequest): AskResponse {
  const hi = req.mode === 'brief' ? req.lang === 'hi' : isHindi(req.message);
  return {
    answer: hi ? 'माफ़ कीजिए, अभी जवाब नहीं दे पाया। कृपया थोड़ी देर बाद फिर से पूछें।' : 'Sorry, I could not answer that just now. Please try again in a moment.',
    evidence: [],
    suggestedActions: [],
  };
}

export async function ask(store: Store, req: AskRequest): Promise<AskResponse> {
  const mode = req.mode ?? 'ask';
  if (mode === 'ask' && !req.message?.trim()) return { answer: 'Please type a question.', evidence: [], suggestedActions: [] };
  const dataset: Dataset = req.dataset === 'replay' ? 'replay' : 'live';
  const started = Date.now();
  try {
    const now = await datasetNow(store, dataset);
    const capture: ToolCapture = {};
    const history = (req.history ?? []).slice(-config.agent.historyTurns).map((h) => ({ role: h.role, content: [{ text: h.text }] }));
    const agent = new Agent({
      model: await getModel(),
      systemPrompt: systemPrompt(mode, now, dataset, req.lang),
      tools: buildTools(store, dataset, now, capture),
      messages: history,
      printer: false,
    });

    let calls = 0;
    const t0 = new Map<string, number>();
    agent.addHook(BeforeToolCallEvent, (e) => {
      calls++;
      if (calls > config.agent.maxToolCalls) {
        e.cancel = 'Tool call limit reached. Answer now with what you already have.';
        return;
      }
      t0.set(e.toolUse.toolUseId, Date.now());
    });
    agent.addHook(AfterToolCallEvent, (e) => {
      log({ step: 'agent_tool', tool: e.toolUse.name, ms: Date.now() - (t0.get(e.toolUse.toolUseId) ?? Date.now()) });
    });

    let message = mode === 'brief' ? `Write the brief for the next hour${req.lang === 'hi' ? ' in Hindi' : ''}.` : req.message!;
    if (req.stationId && mode === 'ask') message += `\n(Asked from the area page for station id "${req.stationId}".)`;

    const result = await agent.invoke(message, {
      cancelSignal: AbortSignal.timeout(config.agent.timeoutMs),
      limits: { turns: config.agent.maxToolCalls + 2 },
    });
    if (result.stopReason === 'cancelled') throw new Error('agent timed out');
    const answer = readableNames(result.toString().trim());
    if (!answer) throw new Error('empty answer');

    // Evidence from the last diagnose, else the incident from list_incidents
    const incident = capture.incident;
    const evidence = capture.diagnosis?.evidence ?? incident?.evidence.filter((c) => c.cause === incident.topCause) ?? [];
    const suggestedActions: AskResponse['suggestedActions'] = [];
    if (incident) {
      suggestedActions.push({ type: 'open_incident', label: `Open the ${incident.area} incident`, payload: { incidentId: incident.id } });
      if (incident.status === 'open' || incident.status === 'recurred') {
        suggestedActions.push({ type: 'issue_work_order', label: 'Issue a work order', payload: { incidentId: incident.id } });
      }
    }
    if (mode === 'brief') suggestedActions.push({ type: 'open_board', label: 'Open the action board' });

    log({ step: 'agent', mode, dataset, ms: Date.now() - started, toolCalls: calls, stopReason: result.stopReason });
    return { answer, evidence: evidence.slice(0, 5), ...(incident ? { incidentId: incident.id } : {}), suggestedActions };
  } catch (e) {
    log({ level: 'error', step: 'agent', mode, ms: Date.now() - started, message: (e as Error).message });
    return apology(req);
  }
}
