'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Board, StationSummary } from '@wajah/shared';
import { useApp } from '../../lib/context';
import { getBoard, getStations, issueWorkOrder } from '../../lib/api';
import { BriefCard } from '../../components/BriefCard';
import { BandPill } from '../../components/BandPill';
import { StatusBadge } from '../../components/StatusBadge';
import { MapView } from '../../components/MapView';
import { actionLabel, causeLabel, confidenceLabel, t } from '../../lib/i18n';
import { formatDateIST } from '../../lib/utils';

export default function BoardPage() {
  const router = useRouter();
  const { dataset, lang } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, st] = await Promise.all([getBoard(dataset), getStations(dataset)]);
      setBoard(b);
      setStations(st);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dataset]);

  const handleIssue = async (e: React.MouseEvent, incidentId: string, actionType?: any, agency?: any) => {
    e.preventDefault();
    e.stopPropagation();
    setIssuingId(incidentId);
    try {
      const res = await issueWorkOrder(incidentId, { actionType, agency });
      // Reload board to update state
      const updated = await getBoard(dataset);
      setBoard(updated);
      router.push(`/incident/${incidentId}?dataset=${dataset}`);
    } catch {
      // fallback navigate
      router.push(`/incident/${incidentId}?dataset=${dataset}`);
    } finally {
      setIssuingId(null);
    }
  };

  if (loading || !board) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-rule" />
        <div className="h-12 w-3/4 bg-rule" />
        <div className="h-40 bg-rule" />
        <div className="h-64 bg-rule" />
      </div>
    );
  }

  const actionableItems = board.items.filter((item) => item.localActionPossible);
  const noLocalFixItems = board.items.filter((item) => !item.localActionPossible);
  const topItem = actionableItems[0];

  const todayStr = formatDateIST(new Date().toISOString());

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
          {lang === 'hi'
            ? `कार्रवाई बोर्ड · ${todayStr} · अपडेटेड ${new Date().getHours()}:00`
            : `Action board · ${todayStr} · updated ${new Date().getHours()}:00`}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink mt-2 leading-tight">
          {topItem
            ? lang === 'hi'
              ? `इस घंटे ${board.summary.actionable} स्पाइक्स के लिए कार्य आदेश की आवश्यकता है। ${topItem.incident.area} से शुरू करें।`
              : `${board.summary.actionable} spikes need a work order this hour. Start with ${topItem.incident.area}.`
            : lang === 'hi'
            ? 'इस घंटे किसी भी हॉटस्पॉट पर कार्रवाई की आवश्यकता नहीं है।'
            : 'No hotspot needs action this hour.'}
        </h1>
        <div className="mt-2 text-xs sm:text-sm font-mono text-ink-2 flex flex-wrap gap-2">
          <span>
            {lang === 'hi'
              ? `${board.summary.actionable} स्पाइक्स को कार्य आदेश चाहिए`
              : `${board.summary.actionable} spikes need a work order`}
          </span>
          <span>·</span>
          <span>
            {lang === 'hi'
              ? `${board.summary.inProgress} कार्य आदेश प्रगति पर है`
              : `${board.summary.inProgress} work order in progress`}
          </span>
          <span>·</span>
          <span>
            {lang === 'hi'
              ? `${board.summary.noLocalAction} का कोई स्थानीय समाधान नहीं`
              : `${board.summary.noLocalAction} with no local fix`}
          </span>
        </div>
      </div>

      {/* Main Grid: Left Items + Right Mini Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (8 cols): Brief Card + Ranked Board Rows */}
        <div className="lg:col-span-8 space-y-6">
          {/* Brief Card */}
          <BriefCard />

          {/* Section: Needs Action */}
          <div>
            <div className="flex items-center justify-between border-b-2 border-ink pb-2 mb-3">
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-ink">
                {lang === 'hi' ? 'कार्रवाई आवश्यक, सर्वोच्च प्राथमिकता पहले' : 'NEEDS ACTION, HIGHEST PRIORITY FIRST'}
              </span>
              <span className="hidden sm:inline text-xs font-mono text-ink-3">
                {lang === 'hi' ? 'अधिकतम स्तर · संभावित कारण · क्या करना है' : 'Peak · likely cause · what to do'}
              </span>
            </div>

            <div className="space-y-3">
              {actionableItems.map((item, idx) => {
                const inc = item.incident;
                const rank = idx + 1;
                const isTop = rank === 1;
                const activeWo = inc.workOrders.find(
                  (w) => w.status === 'issued' || w.status === 'in_progress'
                );
                const hasChanged = item.history.tried >= 2 && item.history.worked === 0;

                const peakVal = inc.topCause === 'dust' && inc.peakPm10 ? inc.peakPm10 : inc.peakPm25;
                const peakPollutant = inc.topCause === 'dust' && inc.peakPm10 ? 'PM10' : 'PM2.5';
                const peakBand = peakVal > 250 ? 'severe' : peakVal > 120 ? 'very_poor' : 'poor';

                return (
                  <Link
                    key={inc.id}
                    href={`/incident/${inc.id}?dataset=${dataset}`}
                    className="block p-4 border border-ink bg-sheet hover:bg-paper/60 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Left info: Rank + Area + Peak */}
                      <div className="flex items-start gap-3">
                        <span className="font-serif text-2xl sm:text-3xl font-extrabold text-ink leading-none shrink-0 w-6">
                          {rank}
                        </span>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-serif text-xl sm:text-2xl font-extrabold text-ink underline decoration-1">
                              {inc.area}
                            </span>
                            <StatusBadge status={inc.status} recurrenceCount={inc.recurrenceCount} />
                          </div>

                          <div className="flex items-center gap-2">
                            <BandPill value={peakVal} band={peakBand} pollutant={peakPollutant} variant="compact" />
                            <div className="text-xs font-mono text-ink-2">
                              <div>{peakPollutant} {lang === 'hi' ? 'अधिकतम' : 'peak'}</div>
                              <div className="capitalize font-bold text-ink">
                                {lang === 'hi' ? (peakBand === 'severe' ? 'गंभीर' : peakBand === 'very_poor' ? 'बहुत खराब' : 'खराब') : peakBand.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle info: Likely Cause + Recommended Action */}
                      <div className="flex-1 sm:px-4 space-y-2 border-t sm:border-t-0 sm:border-l border-rule pt-2 sm:pt-0">
                        <div>
                          <div className="font-serif font-bold text-base text-ink">
                            {causeLabel(inc.topCause, lang)}
                          </div>
                          <div className="text-xs font-mono text-ink-3 capitalize">
                            {lang === 'hi' ? `विश्वसनीयता: ${confidenceLabel(inc.confidence, lang)}` : `Confidence: ${inc.confidence}`}
                          </div>
                        </div>

                        <div>
                          <div className="font-sans font-bold text-sm text-ink flex items-center gap-1.5">
                            <span>{actionLabel(item.recommended.actionType, lang)}</span>
                            <span className="text-xs font-mono text-ink-3 font-normal">
                              {item.recommended.agency}
                            </span>
                          </div>

                          {hasChanged && (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-ink text-white mr-1.5 mt-0.5">
                              {lang === 'hi' ? 'बदला गया' : 'CHANGED'}
                            </span>
                          )}

                          <div className="text-xs font-sans text-ink-2 mt-0.5">
                            {item.recommended.reason}
                          </div>
                        </div>
                      </div>

                      {/* Right Action Button / Status */}
                      <div className="shrink-0 flex items-center sm:justify-end">
                        {activeWo ? (
                          <div className="text-left sm:text-right font-mono text-xs">
                            <div className="font-bold text-ink">{activeWo.id.toUpperCase()}</div>
                            <div className="text-ink-3">
                              {lang === 'hi' ? 'प्रगति पर' : 'In progress'}
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleIssue(e, inc.id, item.recommended.actionType, item.recommended.agency)}
                            disabled={issuingId === inc.id}
                            className={`w-full sm:w-auto px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                              isTop
                                ? 'bg-ink text-white hover:bg-ink-2'
                                : 'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-white'
                            }`}
                          >
                            {issuingId === inc.id
                              ? (lang === 'hi' ? 'जारी किया जा रहा है...' : 'Issuing...')
                              : (lang === 'hi' ? 'कार्य आदेश जारी करें' : 'Issue work order')}
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section: No Local Fix */}
          {noLocalFixItems.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center justify-between border-b border-dashed border-ink pb-2 mb-3">
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-ink-3">
                  {lang === 'hi' ? `कोई स्थानीय समाधान नहीं (${noLocalFixItems.length})` : `NO LOCAL FIX (${noLocalFixItems.length})`}
                </span>
                <span className="text-xs font-mono text-ink-3">
                  {lang === 'hi' ? 'भेजने के लिए कुछ नहीं' : 'Nothing to dispatch'}
                </span>
              </div>

              <div className="space-y-3">
                {noLocalFixItems.map((item, idx) => {
                  const inc = item.incident;
                  const rank = actionableItems.length + idx + 1;

                  return (
                    <Link
                      key={inc.id}
                      href={`/incident/${inc.id}?dataset=${dataset}`}
                      className="block p-4 border border-dashed border-rule bg-sheet/80 hover:bg-paper/60 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="font-serif text-2xl sm:text-3xl font-extrabold text-ink-3 leading-none shrink-0 w-6">
                            {rank}
                          </span>
                          <div>
                            <div className="font-serif text-xl font-extrabold text-ink">
                              {inc.area}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <BandPill value={inc.peakPm25} band="severe" pollutant="PM2.5" variant="compact" />
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 sm:px-4 space-y-1">
                          <div className="font-serif font-bold text-base text-ink">
                            {causeLabel(inc.topCause, lang)}
                          </div>
                          <div className="text-xs font-sans text-ink-2">
                            {item.recommended.reason}
                          </div>
                        </div>

                        <div className="shrink-0">
                          <button
                            onClick={(e) => handleIssue(e, inc.id, 'public_advisory', 'Residents')}
                            className="w-full sm:w-auto px-4 py-2 border border-ink font-mono text-xs font-bold uppercase hover:bg-ink hover:text-white transition-colors"
                          >
                            {lang === 'hi' ? 'जन सलाह जारी करें' : 'Issue public advisory'}
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Side Map "Where they are" */}
        <div className="hidden lg:block lg:col-span-4 space-y-4 sticky top-20">
          <div className="border border-ink bg-sheet p-3">
            <div className="text-xs font-mono font-bold tracking-wider uppercase text-ink mb-2">
              {t('where_they_are', lang)}
            </div>
            <div className="h-[420px] w-full border border-rule">
              <MapView
                stations={stations}
                incidents={board.items.map((i) => i.incident)}
                zoom={10}
                onSelectStation={(st) => router.push(`/area/${st.id}?dataset=${dataset}`)}
              />
            </div>
            <p className="font-sans text-xs text-ink-3 mt-2 leading-tight">
              {lang === 'hi'
                ? 'काली पट्टी इस बोर्ड पर रैंक दर्शाती है। WO का मतलब है कि कार्य आदेश प्रगति पर है।'
                : 'The black tab is the rank on this board. WO means a work order is in progress.'}
            </p>
            <Link
              href={`/map?dataset=${dataset}`}
              className="mt-3 block font-mono text-xs font-bold underline text-ink hover:opacity-80"
            >
              {lang === 'hi' ? 'पूरा नक्शा देखें →' : 'Open the full map →'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
