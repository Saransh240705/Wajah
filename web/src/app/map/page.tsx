'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Fire, Incident, StationSummary } from '@wajah/shared';
import { useApp } from '../../lib/context';
import { getFires, getIncidents, getStations } from '../../lib/api';
import { MapView } from '../../components/MapView';
import { BandPill } from '../../components/BandPill';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateIST } from '../../lib/utils';
import { bandLabel, causeLabel } from '../../lib/i18n';

export default function MapPage() {
  const router = useRouter();
  const { dataset, lang } = useApp();

  const [stations, setStations] = useState<StationSummary[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [fires, setFires] = useState<Fire[]>([]);
  const [selectedStation, setSelectedStation] = useState<StationSummary | null>(null);
  const [showFires, setShowFires] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [st, inc, f] = await Promise.all([
          getStations(dataset),
          getIncidents({ dataset }),
          getFires(dataset, 48),
        ]);
        setStations(st);
        setIncidents(inc);
        setFires(f);
        if (st.length > 0) {
          const anandVihar = st.find((s) => s.id === 'anand-vihar') || st[0];
          setSelectedStation(anandVihar || null);
        }
      } catch {
        // handled
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dataset]);

  if (loading) {
    return (
      <div className="h-[700px] w-full border border-ink bg-sheet flex items-center justify-center font-mono text-xs text-ink-3">
        {lang === 'hi' ? 'दिल्ली वायु गुणवत्ता नक्शा लोड हो रहा है…' : 'Loading Delhi air quality map…'}
      </div>
    );
  }

  // Fix 2: a station is "spiking" only when the API says it has an open incident
  const activeStations = stations.filter((s) => s.openIncidentId != null);

  // Fix 5: use the dataset's own clock (latest reading time), not browser Date
  const latestReadingTs = stations
    .map((s) => s.latest?.ts)
    .filter(Boolean)
    .sort()
    .at(-1);
  const nowLabel = latestReadingTs
    ? formatDateIST(latestReadingTs)
    : formatDateIST(new Date().toISOString());

  const activeIncidents = incidents.filter(
    (i) => i.status === 'open' || i.status === 'dispatched' || i.status === 'recurred'
  );

  const selectedIncident = activeIncidents.find((i) => i.stationId === selectedStation?.id);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
          {lang === 'hi' ? `नक्शा · ${nowLabel}` : `Map · ${nowLabel}`}
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-ink mt-1">
          {activeStations.length > 0
            ? lang === 'hi'
              ? `वर्तमान में ${activeStations.length} क्षेत्रों में स्तर बढ़ा हुआ है।`
              : `${activeStations.length} area${activeStations.length === 1 ? '' : 's'} spiking now.`
            : lang === 'hi'
            ? 'सभी निगरानी क्षेत्र सामान्य स्तर पर हैं।'
            : 'All monitored areas within usual levels.'}
        </h1>
      </div>

      {/* Main Container: Left Sidebar + Right Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Incidents List */}
          <div className="border border-ink bg-sheet p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-rule pb-2">
              <span className="text-xs font-mono font-bold tracking-wider text-ink uppercase">
                {lang === 'hi' ? `सक्रिय घटनाएं · ${activeIncidents.length}` : `ACTIVE INCIDENTS · ${activeIncidents.length}`}
              </span>
              <Link
                href={`/board?dataset=${dataset}`}
                className="font-mono text-xs font-bold underline text-ink"
              >
                {lang === 'hi' ? 'बोर्ड खोलें →' : 'Open board →'}
              </Link>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeIncidents.map((inc) => (
                <div
                  key={inc.id}
                  onClick={() => {
                    const st = stations.find((s) => s.id === inc.stationId);
                    if (st) setSelectedStation(st);
                  }}
                  className={`p-2.5 border cursor-pointer transition-colors ${
                    selectedStation?.id === inc.stationId
                      ? 'border-2 border-ink bg-paper'
                      : 'border-rule bg-sheet hover:bg-paper/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-sm text-ink">{inc.area}</span>
                    <StatusBadge status={inc.status} recurrenceCount={inc.recurrenceCount} />
                  </div>
                  {/* Fix 4: show date+time so same area on different days is distinguishable */}
                  <div className="text-[10px] font-mono text-ink-3 mt-0.5">
                    {formatDateIST(inc.start)}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono text-ink-2">
                    <span className="font-bold text-ink">
                      {inc.topCause === 'dust' && inc.peakPm10 ? inc.peakPm10 : inc.peakPm25}
                    </span>
                    <span>{causeLabel(inc.topCause, lang)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Station Card */}
          {selectedStation && (
            <div className="border-2 border-ink bg-sheet p-4 space-y-3">
              <div className="text-xs font-mono uppercase font-bold text-ink-3">
                {selectedStation.name} {lang === 'hi' ? 'चयनित' : 'SELECTED'}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-slab text-4xl font-normal text-ink">
                    {selectedStation.latest?.pm25 ? Math.round(selectedStation.latest.pm25) : '--'}
                  </div>
                  <div className="text-xs font-mono text-ink-2 capitalize">
                    {bandLabel(selectedStation.band, lang)} · {selectedStation.isHotspot ? (lang === 'hi' ? 'हॉटस्पॉट' : 'Hotspot') : (lang === 'hi' ? 'तुलना स्टेशन' : 'Comparison station')}
                  </div>
                </div>
                <BandPill
                  value={selectedStation.latest?.pm25 ? Math.round(selectedStation.latest.pm25) : '--'}
                  band={selectedStation.band}
                  variant="legend"
                />
              </div>

              {selectedIncident && (
                <div className="p-2.5 bg-paper border border-rule text-xs font-sans text-ink">
                  {lang === 'hi'
                    ? `${selectedIncident.start.slice(11, 16)} से ${causeLabel(selectedIncident.topCause, lang)} का स्तर बढ़ा हुआ देखा गया।`
                    : `A ${selectedIncident.topCause.replace('_', ' ')} spike detected since ${selectedIncident.start.slice(11, 16)}.`}
                </div>
              )}

              {/* Fix 3: show reading's own timestamp when it may be stale */}
              <div className="text-[10px] font-mono text-ink-3">
                {selectedStation.latest?.ts
                  ? lang === 'hi'
                    ? `अंतिम रीडिंग ${formatDateIST(selectedStation.latest.ts)}`
                    : `Last reading ${formatDateIST(selectedStation.latest.ts)}`
                  : lang === 'hi' ? 'कोई हालिया रीडिंग नहीं' : 'No recent reading'}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={`/area/${selectedStation.id}?dataset=${dataset}`}
                  className="px-3 py-1.5 border border-ink bg-paper font-mono text-xs font-bold hover:bg-ink hover:text-white transition-colors"
                >
                  {lang === 'hi' ? 'पिछले 48 घंटे' : 'Last 48 hours'}
                </Link>
                {selectedIncident && (
                  <Link
                    href={`/incident/${selectedIncident.id}?dataset=${dataset}`}
                    className="px-3 py-1.5 bg-ink text-white font-mono text-xs font-bold hover:bg-ink-2 transition-colors"
                  >
                    {lang === 'hi' ? 'घटना विवरण खोलें' : 'Open incident'}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Farm Fires Toggle */}
          <div className="border border-rule bg-sheet p-3 flex items-center justify-between">
            <div className="font-mono text-xs font-bold text-ink">
              {lang === 'hi' ? 'खेतों की आग और हवा · वैकल्पिक परत' : 'Farm fires and wind · optional layer'}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFires}
                onChange={(e) => setShowFires(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-rule peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:h-4 after:w-4 after:transition-all peer-checked:bg-ink"></div>
            </label>
          </div>

          {/* Map Legend */}
          <div className="border border-rule bg-sheet p-4 space-y-3 font-mono text-xs text-ink-2">
            <div className="font-bold text-ink uppercase tracking-wider">
              {lang === 'hi' ? 'नक्शा कैसे पढ़ें' : 'READING THE MAP'}
            </div>
            <div className="grid grid-cols-3 gap-1 text-[11px] text-center">
              <div className="bg-band-good text-white p-1">{lang === 'hi' ? 'अच्छा 0-30' : 'Good 0-30'}</div>
              <div className="bg-band-satisfactory text-ink p-1">{lang === 'hi' ? 'संतोषजनक 31-60' : 'Sat 31-60'}</div>
              <div className="bg-band-moderate text-ink p-1">{lang === 'hi' ? 'मध्यम 61-90' : 'Mod 61-90'}</div>
              <div className="bg-band-poor text-ink p-1">{lang === 'hi' ? 'खराब 91-120' : 'Poor 91-120'}</div>
              <div className="bg-band-very-poor text-white p-1">{lang === 'hi' ? 'बहुत खराब 121-250' : 'V.Poor 121-250'}</div>
              <div className="bg-band-severe text-white p-1">{lang === 'hi' ? 'गंभीर 250+' : 'Severe 250+'}</div>
            </div>
            <div className="space-y-1.5 pt-2 text-[11px]">
              <div>{lang === 'hi' ? '• मोटी सीमा: हॉटस्पॉट स्टेशन' : '• Heavy border: Hotspot station'}</div>
              <div>{lang === 'hi' ? '• पतली सीमा: तुलना स्टेशन' : '• Thin border: Comparison station'}</div>
              <div>{lang === 'hi' ? '• घेरा: सक्रिय स्पाइक घटना' : '• Ring: Active spike incident'}</div>
              <div>{lang === 'hi' ? '• WO: कार्य आदेश प्रगति पर' : '• WO tab: Work order in progress'}</div>
            </div>
          </div>
        </div>

        {/* Right Map (8 cols) */}
        <div className="lg:col-span-8 h-[640px] border-2 border-ink">
          <MapView
            stations={stations}
            incidents={incidents}
            fires={fires}
            showFires={showFires}
            selectedStationId={selectedStation?.id}
            onSelectStation={(st) => setSelectedStation(st)}
            zoom={11}
          />
        </div>
      </div>
    </div>
  );
}
