'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { Incident, LedgerRow, Reading, Station, Weather } from '@wajah/shared';
import { useApp } from '../../../lib/context';
import { getLedger, getStationReadings } from '../../../lib/api';
import { BandPill } from '../../../components/BandPill';
import { ReadingChart } from '../../../components/ReadingChart';
import { formatDateTimeRangeIST, formatPct } from '../../../lib/utils';
import { actionLabel, bandLabel, causeLabel, statusLabel, verdictLabel } from '../../../lib/i18n';

export default function AreaPage({ params }: { params: Promise<{ stationId: string }> }) {
  const resolvedParams = use(params);
  const { dataset, lang } = useApp();

  const [station, setStation] = useState<Station | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [weather, setWeather] = useState<Weather[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [stData, ledger] = await Promise.all([
          getStationReadings(resolvedParams.stationId, 48, dataset),
          getLedger(dataset, 14),
        ]);
        setStation(stData.station);
        setReadings(stData.readings);
        setWeather(stData.weather);
        setIncidents(stData.incidents);
        setLedgerRows(ledger.rows.filter((r) => r.stationId === resolvedParams.stationId));
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [resolvedParams.stationId, dataset]);

  if (loading || !station) {
    return (
      <div className="space-y-6 animate-pulse max-w-4xl mx-auto">
        <div className="h-6 w-32 bg-rule" />
        <div className="h-12 w-3/4 bg-rule" />
        <div className="h-64 bg-rule" />
      </div>
    );
  }

  const latestReading = readings.at(-1);
  const currentPm25 = latestReading?.pm25 ? Math.round(latestReading.pm25) : 268;
  const currentBand = currentPm25 > 250 ? 'severe' : currentPm25 > 120 ? 'very_poor' : 'poor';

  const activeInc = incidents.find((i) => i.status === 'open' || i.status === 'dispatched' || i.status === 'recurred');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href={`/map?dataset=${dataset}`}
          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ink underline hover:opacity-80"
        >
          <span>&lt;</span>
          <span>{lang === 'hi' ? 'नक्शे पर वापस' : 'Map'}</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b-2 border-ink pb-6">
        <div className="space-y-2 flex-1">
          <div className="text-xs font-mono text-ink-3 uppercase">
            {lang === 'hi'
              ? `क्षेत्र · ${station.area} · ${station.isHotspot ? 'हॉटस्पॉट' : 'स्टेशन'} · अपडेटेड ${new Date().getHours()}:00`
              : `Area · ${station.area} · ${station.isHotspot ? 'Hotspot' : 'Station'} · updated ${new Date().getHours()}:00`}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-ink leading-tight">
            {lang === 'hi'
              ? `वर्तमान में ${bandLabel(currentBand, lang)}। ${activeInc ? `${causeLabel(activeInc.topCause, lang)} का स्तर हाल ही में बढ़ा।` : 'स्तर स्थिर हैं।'}`
              : `${currentBand.replace('_', ' ').toUpperCase()} now. ${activeInc ? `A ${activeInc.topCause.replace('_', ' ')} spike began recently.` : 'Levels are stable.'}`}
          </h1>

          {activeInc && (
            <div className="pt-2">
              <Link
                href={`/incident/${activeInc.id}?dataset=${dataset}`}
                className="inline-block px-4 py-2 bg-ink text-white font-mono text-xs font-bold uppercase hover:bg-ink-2 transition-colors"
              >
                {lang === 'hi' ? "आज की घटना खोलें →" : "Open today's incident →"}
              </Link>
            </div>
          )}
        </div>

        <div className="shrink-0">
          <BandPill value={currentPm25} band={currentBand} pollutant="PM2.5" variant="large" />
        </div>
      </div>

      {/* 48-Hour Air Quality Chart */}
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase font-bold text-ink-3">
          {lang === 'hi' ? 'पिछले 48 घंटे' : 'THE LAST 48 HOURS'}
        </div>
        <ReadingChart readings={readings} incidents={incidents} />
      </div>

      {/* Wind condition line */}
      <div className="p-3 border border-rule bg-sheet text-xs font-mono text-ink-2 flex items-center justify-between">
        <span>
          {lang === 'hi'
            ? 'हवा: उत्तर-पश्चिम 4-5 मीटर/सेकंड। शुष्क मौसम में धूल बिखरने के लिए उपयुक्त।'
            : 'Wind: Northwest at 4-5 m/s. Suitable for road dust dispersion when dry.'}
        </span>
        <span>↗ 4.8 m/s</span>
      </div>

      {/* Incidents Here list */}
      <div className="space-y-4 pt-4 border-t border-rule">
        <div className="text-xs font-mono uppercase font-bold text-ink-3">
          {lang === 'hi' ? 'यहाँ की घटनाएं, नवीनतम पहले' : 'INCIDENTS HERE, NEWEST FIRST'}
        </div>

        <div className="space-y-2">
          {incidents.slice(0, 5).map((inc) => {
            const peak = inc.topCause === 'dust' && inc.peakPm10 ? inc.peakPm10 : inc.peakPm25;
            const pol = inc.topCause === 'dust' && inc.peakPm10 ? 'PM10' : 'PM2.5';
            const wo = inc.workOrders[0];

            return (
              <Link
                key={inc.id}
                href={`/incident/${inc.id}?dataset=${dataset}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-rule bg-sheet hover:bg-paper transition-colors gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-base text-ink w-12">
                    {peak}
                  </span>
                  <div>
                    <div className="font-serif font-bold text-sm text-ink">
                      {formatDateTimeRangeIST(inc.start, inc.end)}
                    </div>
                    <div className="text-xs font-mono text-ink-3">
                      {causeLabel(inc.topCause, lang)} · {pol} {lang === 'hi' ? 'अधिकतम' : 'peak'}
                    </div>
                  </div>
                </div>

                <div>
                  {wo?.effect ? (
                    <span className="px-2 py-0.5 bg-ink text-white font-mono text-xs font-bold">
                      {wo.effect.verdict === 'worked'
                        ? (lang === 'hi' ? '✓ असर हुआ' : '✓ Worked')
                        : (lang === 'hi' ? '✕ असर नहीं हुआ' : '✕ No effect')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 border border-ink font-mono text-xs font-bold text-ink">
                      {statusLabel(inc.status, lang)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* What Has Been Tried Here */}
      <div className="space-y-4 pt-4 border-t border-rule">
        <div className="text-xs font-mono uppercase font-bold text-ink-3">
          {lang === 'hi' ? 'यहाँ क्या उपाय किए गए हैं' : 'WHAT HAS BEEN TRIED HERE'}
        </div>

        <div className="space-y-2">
          {ledgerRows.length > 0 ? (
            ledgerRows.map((r, i) => (
              <div key={i} className="p-3 border border-rule bg-sheet flex items-center justify-between">
                <div>
                  <div className="font-serif font-bold text-sm text-ink">
                    {actionLabel(r.actionType, lang)}
                  </div>
                  <div className="text-xs font-mono text-ink-3 mt-0.5">
                    {lang === 'hi'
                      ? `${r.tried} में से ${r.worked} बार असर हुआ`
                      : `Worked ${r.worked} of ${r.tried} times`}
                  </div>
                </div>
                <div className="font-mono font-bold text-sm text-ink">
                  {formatPct(r.avgNetChangePct)}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 border border-dashed border-rule bg-paper text-xs font-mono text-ink-3">
              {lang === 'hi'
                ? 'इस हॉटस्पॉट के लिए अभी तक कोई कार्य आदेश दर्ज नहीं है।'
                : 'No work orders recorded for this hotspot yet.'}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/ledger?dataset=${dataset}`}
            className="font-mono text-xs font-bold underline text-ink"
          >
            {lang === 'hi' ? 'पूरा रिकॉर्ड देखें →' : 'Open the full ledger →'}
          </Link>
          <Link
            href={`/ask?stationId=${station.id}&dataset=${dataset}`}
            className="px-3 py-1.5 border border-ink bg-paper font-mono text-xs font-bold hover:bg-ink hover:text-white transition-colors"
          >
            {lang === 'hi' ? 'कारण पूछें' : 'Ask why'}
          </Link>
        </div>
      </div>
    </div>
  );
}
