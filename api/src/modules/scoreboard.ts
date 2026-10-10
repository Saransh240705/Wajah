import type { Cause, Incident, Scoreboard } from '@wajah/shared';

/** Scoreboard over the given incidents (already filtered to the dataset and period). Pure. */
export function buildScoreboard(incidents: Incident[]): Scoreboard {
  const byStation = new Map<string, Incident[]>();
  for (const i of incidents) byStation.set(i.stationId, [...(byStation.get(i.stationId) ?? []), i]);
  const count = (list: Incident[], s: Incident['status']) => list.filter((i) => i.status === s).length;
  const topCause = (list: Incident[]): Cause | null => {
    const n = new Map<Cause, number>();
    for (const i of list) n.set(i.topCause, (n.get(i.topCause) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  return {
    totals: {
      incidents: incidents.length,
      dispatched: count(incidents, 'dispatched'),
      cleared: count(incidents, 'cleared'),
      recurred: count(incidents, 'recurred'),
    },
    areas: [...byStation.entries()]
      .map(([stationId, list]) => ({
        stationId,
        area: list[0]!.area,
        incidents: list.length,
        recurred: count(list, 'recurred'),
        cleared: count(list, 'cleared'),
        topCause: topCause(list),
        lastIncidentAt: list.reduce((a, i) => (i.start > a ? i.start : a), list[0]!.start),
      }))
      .sort((a, b) => b.incidents - a.incidents || b.recurred - a.recurred || a.area.localeCompare(b.area)),
  };
}
