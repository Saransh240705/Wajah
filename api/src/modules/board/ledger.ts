import type { ActionType, Incident, Ledger, LedgerRow, Verdict } from '@wajah/shared';
import { ACTIONS } from '@wajah/shared';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface BuildLedgerOptions {
  days?: number;
  now: string;
}

function loadPlacebo(): Ledger['placebo'] {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const p = join(here, '../../../../shared/src/placebo.json');
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf-8'));
    }
  } catch {
    // optional placebo
  }
  return null;
}

export function buildLedger(incidents: Incident[], opts: BuildLedgerOptions): Ledger {
  const days = opts.days ?? 14;
  const nowMs = Date.parse(opts.now);
  const cutoffMs = nowMs - days * 24 * 3600_000;

  // Group measured work orders by stationId and actionType
  const groups = new Map<string, {
    stationId: string;
    area: string;
    actionType: ActionType;
    worked: number;
    noEffect: number;
    inconclusive: number;
    netChanges: number[];
    demoCount: number;
    totalCount: number;
  }>();

  let totalIssued = 0;
  let totalMeasured = 0;
  let totalWorked = 0;
  let totalNoEffect = 0;
  let totalInconclusive = 0;

  for (const incident of incidents) {
    for (const wo of incident.workOrders) {
      if (wo.status === 'cancelled' || !ACTIONS[wo.actionType].measurable) {
        continue;
      }
      const issuedMs = Date.parse(wo.issuedAt);
      if (issuedMs < cutoffMs || issuedMs > nowMs) {
        continue;
      }

      totalIssued++;

      if (wo.effect) {
        totalMeasured++;
        const key = `${wo.stationId}#${wo.actionType}`;
        let g = groups.get(key);
        if (!g) {
          g = {
            stationId: wo.stationId,
            area: wo.area || incident.area,
            actionType: wo.actionType,
            worked: 0,
            noEffect: 0,
            inconclusive: 0,
            netChanges: [],
            demoCount: 0,
            totalCount: 0,
          };
          groups.set(key, g);
        }

        g.totalCount++;
        if (wo.demo) g.demoCount++;

        const v: Verdict = wo.effect.verdict;
        if (v === 'worked') {
          g.worked++;
          totalWorked++;
          if (typeof wo.effect.netChangePct === 'number') {
            g.netChanges.push(wo.effect.netChangePct);
          }
        } else if (v === 'no_effect') {
          g.noEffect++;
          totalNoEffect++;
          if (typeof wo.effect.netChangePct === 'number') {
            g.netChanges.push(wo.effect.netChangePct);
          }
        } else if (v === 'inconclusive') {
          g.inconclusive++;
          totalInconclusive++;
        }
      }
    }
  }

  const rows: LedgerRow[] = [...groups.values()].map((g) => {
    const tried = g.worked + g.noEffect + g.inconclusive;
    const avgNetChangePct = g.netChanges.length > 0
      ? Math.round(g.netChanges.reduce((a, b) => a + b, 0) / g.netChanges.length)
      : null;

    return {
      stationId: g.stationId,
      area: g.area,
      actionType: g.actionType,
      tried,
      worked: g.worked,
      noEffect: g.noEffect,
      inconclusive: g.inconclusive,
      avgNetChangePct,
      illustrative: g.totalCount > 0 && g.demoCount === g.totalCount,
    };
  }).sort((a, b) => a.area.localeCompare(b.area) || a.actionType.localeCompare(b.actionType));

  return {
    totals: {
      issued: totalIssued,
      measured: totalMeasured,
      worked: totalWorked,
      noEffect: totalNoEffect,
      inconclusive: totalInconclusive,
    },
    placebo: loadPlacebo(),
    rows,
  };
}
