import type { Board, BoardItem, Incident, Ledger } from '@wajah/shared';
import { recommend } from './recommend';

export function buildBoard(incidents: Incident[], ledger: Ledger, now: string): Board {
  const nowMs = Date.parse(now);
  const cutoffMs = nowMs - 24 * 3600_000;

  const relevant = incidents.filter((i) => {
    const startMs = Date.parse(i.start);
    if (startMs < cutoffMs || startMs > nowMs) return false;

    if (i.status === 'open' || i.status === 'recurred') return true;

    if (i.status === 'dispatched') {
      const latestWo = i.workOrders.at(-1);
      return latestWo != null && latestWo.status !== 'done' && latestWo.status !== 'cancelled';
    }

    return false;
  });

  const items: BoardItem[] = relevant.map((incident) => {
    const weight = incident.confidence === 'high' ? 1.0 : incident.confidence === 'medium' ? 0.8 : 0.5;
    const ratio = incident.baselinePm25 > 0 ? incident.peakPm25 / incident.baselinePm25 : 1;
    const priority = ratio * weight * (1 + 0.25 * (incident.recurrenceCount ?? 0));

    const rec = recommend(incident, ledger.rows);
    const historyRow = ledger.rows.find(
      (r) => r.stationId === incident.stationId && r.actionType === rec.actionType
    );

    const history = {
      tried: historyRow?.tried ?? 0,
      worked: historyRow?.worked ?? 0,
      avgNetChangePct: historyRow?.avgNetChangePct ?? null,
    };

    return {
      incident,
      priority,
      localActionPossible: rec.localActionPossible,
      recommended: {
        actionType: rec.actionType,
        agency: rec.agency,
        reason: rec.reason,
      },
      history,
    };
  });

  // Sort: actionable items first by priority descending, then no-local-action items by priority descending
  items.sort((a, b) => {
    if (a.localActionPossible !== b.localActionPossible) {
      return a.localActionPossible ? -1 : 1;
    }
    return b.priority - a.priority || b.incident.peakPm25 - a.incident.peakPm25;
  });

  let actionable = 0;
  let noLocalAction = 0;
  let inProgress = 0;

  for (const item of items) {
    const isProg = item.incident.status === 'dispatched' &&
      item.incident.workOrders.some((w) => w.status === 'issued' || w.status === 'in_progress');

    if (isProg) {
      inProgress++;
    } else if (item.localActionPossible) {
      actionable++;
    } else {
      noLocalAction++;
    }
  }

  return {
    summary: {
      actionable,
      noLocalAction,
      inProgress,
    },
    items,
  };
}
