import { ACTIONS, PLAYBOOKS, type ActionType, type Agency, type Incident, type LedgerRow } from '@wajah/shared';

export interface Recommendation {
  actionType: ActionType;
  agency: Agency;
  reason: string;
  localActionPossible: boolean;
}

export function recommend(incident: Incident, ledgerRows: LedgerRow[] = []): Recommendation {
  const pb = PLAYBOOKS[incident.topCause];
  if (!pb.localActionPossible) {
    return {
      actionType: 'public_advisory',
      agency: 'Residents',
      reason: pb.doNotEn ?? 'No local action will help. Do not deploy sprinklers.',
      localActionPossible: false,
    };
  }

  const firstStep = pb.steps[0]!;
  const row = ledgerRows.find(
    (r) => r.stationId === incident.stationId && r.actionType === firstStep.actionType
  );

  const judged = (row?.worked ?? 0) + (row?.noEffect ?? 0);

  // If judged twice or more and never worked, switch to the alternative step
  if (judged >= 2 && (row?.worked ?? 0) === 0 && pb.steps.length > 1) {
    const altStep = pb.steps[1]!;
    const firstLabel = ACTIONS[firstStep.actionType].labelEn;
    const altLabel = ACTIONS[altStep.actionType].labelEn.toLowerCase();
    const reason = `${firstLabel} had no effect here ${judged} times. Try ${altLabel}.`;
    return {
      actionType: altStep.actionType,
      agency: altStep.agency,
      reason,
      localActionPossible: true,
    };
  }

  const actionLabel = ACTIONS[firstStep.actionType].labelEn;
  let reason: string;
  if (!row || row.tried === 0 || judged === 0) {
    reason = `${pb.labelEn} is the likely cause. ${actionLabel} has not been tried here yet.`;
  } else {
    reason = `${pb.labelEn} is the likely cause. ${actionLabel} worked here ${row.worked} of ${row.tried} times.`;
  }

  return {
    actionType: firstStep.actionType,
    agency: firstStep.agency,
    reason,
    localActionPossible: true,
  };
}
