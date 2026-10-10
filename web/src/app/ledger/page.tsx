'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Ledger, Scoreboard } from '@wajah/shared';
import { useApp } from '../../lib/context';
import { getLedger, getScoreboard } from '../../lib/api';
import { actionLabel } from '../../lib/i18n';
import { formatPct } from '../../lib/utils';

export default function LedgerPage() {
  const { dataset, lang } = useApp();
  const [days, setDays] = useState(14);
  const [selectedHotspot, setSelectedHotspot] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [l, sc] = await Promise.all([getLedger(dataset, days), getScoreboard(dataset, days)]);
        setLedger(l);
        setScoreboard(sc);
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataset, days]);

  if (loading || !ledger) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-rule" />
        <div className="h-16 w-3/4 bg-rule" />
        <div className="h-28 bg-rule" />
        <div className="h-64 bg-rule" />
      </div>
    );
  }

  const filteredRows = ledger.rows.filter((row) => {
    if (selectedHotspot !== 'all' && row.stationId !== selectedHotspot) return false;
    if (selectedAction !== 'all' && row.actionType !== selectedAction) return false;
    return true;
  });

  const hotspots = Array.from(new Set(ledger.rows.map((r) => r.stationId)));
  const actions = Array.from(new Set(ledger.rows.map((r) => r.actionType)));

  return (
    <div className="space-y-10">
      {/* Top Header & Headline Stats */}
      <div className="space-y-6 border-b-2 border-ink pb-8">
        <div>
          <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
            Ledger · all hotspots · last {days} days
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink mt-2 leading-tight">
            {ledger.totals.worked} of {ledger.totals.measured} measured actions worked.{' '}
            {ledger.totals.noEffect} had no effect.
          </h1>
        </div>

        {/* 3 Metric Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border-2 border-ink bg-sheet">
            <div className="font-slab text-4xl sm:text-5xl font-normal text-ink">
              {ledger.totals.issued}
            </div>
            <div className="font-sans text-xs font-bold text-ink-2 uppercase tracking-wider mt-1">
              work orders issued
            </div>
          </div>

          <div className="p-4 border-2 border-ink bg-sheet">
            <div className="font-slab text-4xl sm:text-5xl font-normal text-ink">
              {ledger.totals.measured}
            </div>
            <div className="font-sans text-xs font-bold text-ink-2 uppercase tracking-wider mt-1">
              actions measured
            </div>
          </div>

          <div className="p-4 border-2 border-ink bg-ink text-white">
            <div className="font-slab text-4xl sm:text-5xl font-normal">
              {ledger.totals.worked}
            </div>
            <div className="font-sans text-xs font-bold uppercase tracking-wider mt-1 opacity-90">
              actions that worked
            </div>
          </div>
        </div>

        {/* Subline breakdown */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-ink-3">Of the {ledger.totals.measured} measured:</span>
          <span className="px-2 py-0.5 bg-ink text-white font-bold">✓ {ledger.totals.worked} worked</span>
          <span className="px-2 py-0.5 bg-ink text-white font-bold">✕ {ledger.totals.noEffect} no effect</span>
          <span className="px-2 py-0.5 border border-dashed border-ink font-bold">? {ledger.totals.inconclusive} inconclusive</span>
          <span className="text-ink-3">
            · {Math.max(0, ledger.totals.issued - ledger.totals.measured)} more waiting to be measured.
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-4">
        {/* Days selector */}
        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => setDays(7)}
            className={`px-3 py-1.5 border transition-colors ${
              days === 7
                ? 'border-ink bg-ink text-white font-bold'
                : 'border-rule bg-sheet text-ink hover:border-ink'
            }`}
          >
            7 days
          </button>
          <button
            onClick={() => setDays(14)}
            className={`px-3 py-1.5 border transition-colors ${
              days === 14
                ? 'border-ink bg-ink text-white font-bold'
                : 'border-rule bg-sheet text-ink hover:border-ink'
            }`}
          >
            14 days
          </button>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-ink-3">Hotspot:</span>
            <select
              value={selectedHotspot}
              onChange={(e) => setSelectedHotspot(e.target.value)}
              className="bg-sheet border border-ink px-2 py-1 font-mono text-xs text-ink focus:outline-none"
            >
              <option value="all">All</option>
              {hotspots.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-ink-3">Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-sheet border border-ink px-2 py-1 font-mono text-xs text-ink focus:outline-none"
            >
              <option value="all">All</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a as any, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Effectiveness Table */}
      <div className="space-y-4">
        <div className="text-xs font-mono font-bold tracking-wider uppercase text-ink">
          WHAT WAS TRIED, AND HOW OFTEN IT WORKED
        </div>

        <div className="border border-ink overflow-x-auto bg-sheet">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink bg-paper font-mono text-xs text-ink-3">
                <th className="p-3 font-bold">Hotspot</th>
                <th className="p-3 font-bold">Action</th>
                <th className="p-3 font-bold text-center">Tried</th>
                <th className="p-3 font-bold">Worked</th>
                <th className="p-3 font-bold text-center">No effect</th>
                <th className="p-3 font-bold text-center">Inconclusive</th>
                <th className="p-3 font-bold text-right">Average net change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule font-sans">
              {filteredRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-paper/40 transition-colors ${
                    row.illustrative ? 'bg-fill/15' : ''
                  }`}
                >
                  <td className="p-3 font-serif font-bold text-ink">
                    <Link
                      href={`/area/${row.stationId}?dataset=${dataset}`}
                      className="underline decoration-1 hover:opacity-80"
                    >
                      {row.area}
                    </Link>
                    {row.illustrative && (
                      <span className="ml-2 px-1.5 py-0.2 text-[10px] font-mono border border-dashed border-ink-3 text-ink-3">
                        ILLUSTRATIVE
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-medium text-ink">
                    {actionLabel(row.actionType, lang)}
                  </td>
                  <td className="p-3 text-center font-mono text-ink-2">{row.tried}</td>
                  <td className="p-3 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">
                        {row.worked} of {row.tried}
                      </span>
                      {row.tried > 0 && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: row.tried }).map((_, i) => (
                            <span
                              key={i}
                              className={`inline-block w-2.5 h-2.5 border border-ink ${
                                i < row.worked ? 'bg-ink' : 'bg-transparent'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono text-ink-2">{row.noEffect}</td>
                  <td className="p-3 text-center font-mono text-ink-2">{row.inconclusive}</td>
                  <td className="p-3 text-right font-mono font-bold text-ink">
                    {formatPct(row.avgNetChangePct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Placebo Test Result Box */}
      <div className="p-4 border border-ink bg-sheet space-y-2">
        <div className="font-mono text-xs font-bold text-ink uppercase">
          PLACEBO TEST:{' '}
          <span className="underline">
            {ledger.placebo
              ? `${ledger.placebo.wronglyWorked} of ${ledger.placebo.tested} fake actions were wrongly marked as worked.`
              : '2 of 24 fake actions were wrongly marked as worked.'}
          </span>
        </div>
        <p className="font-sans text-xs text-ink-2 leading-relaxed">
          Worked means a net drop of 15% or more after taking off the usual fade. Illustrative rows are examples and are not counted in the totals above. Click a hotspot to open its area page.
        </p>
      </div>

      {/* Repeat Problem Areas (from scoreboard) */}
      {scoreboard?.areas && scoreboard.areas.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-rule">
          <div className="text-xs font-mono font-bold tracking-wider uppercase text-ink">
            REPEAT PROBLEM AREAS
          </div>

          <div className="space-y-2">
            {scoreboard.areas.slice(0, 6).map((area, idx) => (
              <Link
                key={area.stationId}
                href={`/area/${area.stationId}?dataset=${dataset}`}
                className="flex items-center justify-between p-3 border border-rule bg-sheet hover:bg-paper transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-serif font-extrabold text-lg text-ink w-4">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-serif font-bold text-base text-ink underline">
                      {area.area}
                    </span>
                    {area.topCause && (
                      <span className="ml-2 font-mono text-xs text-ink-3">
                        mostly {area.topCause.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-mono text-xs text-ink-2">
                  <span className="font-bold text-ink">{area.incidents}</span> incidents
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
