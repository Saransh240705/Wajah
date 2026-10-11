'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Incident, Reading, WorkOrder } from '@wajah/shared';
import { ACTIONS, PLAYBOOKS } from '@wajah/shared';
import { useApp } from '../../../lib/context';
import { getIncident, getStationReadings, issueWorkOrder, measureWorkOrder } from '../../../lib/api';
import { LoopTracker } from '../../../components/LoopTracker';
import { BandPill } from '../../../components/BandPill';
import { StatusBadge } from '../../../components/StatusBadge';
import { CauseCard } from '../../../components/CauseCard';
import { EvidenceRow } from '../../../components/EvidenceRow';
import { RecommendationCard } from '../../../components/RecommendationCard';
import { WorkOrderCard } from '../../../components/WorkOrderCard';
import { EffectCard } from '../../../components/EffectCard';
import { ReadingChart } from '../../../components/ReadingChart';
import { formatDateTimeRangeIST } from '../../../lib/utils';
import { actionLabel, causeLabel } from '../../../lib/i18n';

export default function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { dataset, lang } = useApp();

  const [incident, setIncident] = useState<Incident | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOtherCauses, setShowOtherCauses] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const inc = await getIncident(resolvedParams.id);
      setIncident(inc);
      const stData = await getStationReadings(inc.stationId, 48, dataset);
      setReadings(stData.readings);
    } catch (err: any) {
      setError(err.message || 'Failed to load incident.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [resolvedParams.id, dataset]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-rule" />
        <div className="h-10 w-3/4 bg-rule" />
        <div className="h-48 bg-rule" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-8 border border-ink bg-sheet text-center">
        <h2 className="font-serif text-2xl font-bold text-ink">Incident not found</h2>
        <p className="font-sans text-sm text-ink-2 mt-2">{error}</p>
        <Link
          href={`/board?dataset=${dataset}`}
          className="mt-4 inline-block px-4 py-2 bg-ink text-white font-mono text-xs font-bold uppercase"
        >
          Return to Board
        </Link>
      </div>
    );
  }

  const latestWo: WorkOrder | undefined = incident.workOrders.at(-1);
  const isNoLocalFix = incident.topCause === 'regional_smoke' || incident.topCause === 'trapped_air';

  // Determine current step (1 to 5)
  let currentStep = 3; // Prescribe by default
  if (!latestWo) {
    currentStep = 4; // Ready to act
  } else if (latestWo.status === 'issued' || latestWo.status === 'in_progress') {
    currentStep = 4; // Act in progress
  } else if (latestWo.status === 'done' && !latestWo.effect) {
    currentStep = 5; // Prove waiting
  } else if (latestWo.effect) {
    currentStep = 5; // Prove complete
  }

  // Headline pollutant & peak
  const isDust = incident.topCause === 'dust';
  const peakVal = isDust && incident.peakPm10 ? incident.peakPm10 : incident.peakPm25;
  const pollutant = isDust && incident.peakPm10 ? 'PM10' : 'PM2.5';
  const peakBand = peakVal > 250 ? 'severe' : peakVal > 120 ? 'very_poor' : 'poor';
  const ratio = (peakVal / (incident.baselinePm25 || 100)).toFixed(1);

  // Dynamic status text under headline
  let subText = '';
  if (latestWo?.effect?.verdict === 'worked') {
    subText = lang === 'hi'
      ? `${actionLabel(latestWo.actionType, lang)} का असर हुआ। ${pollutant} सामान्य गिरावट से ${Math.abs(Math.round(latestWo.effect.netChangePct))}% अधिक कम हुआ।`
      : `${actionLabel(latestWo.actionType, lang)} worked. ${pollutant} fell ${Math.abs(Math.round(latestWo.effect.netChangePct))}% more than spikes here usually fade on their own.`;
  } else if (latestWo?.effect?.verdict === 'no_effect') {
    subText = lang === 'hi'
      ? `${actionLabel(latestWo.actionType, lang)} से कोई लाभ नहीं हुआ। गिरावट सामान्य स्तर के समान थी, और स्पाइक दोबारा हो सकता है।`
      : `${actionLabel(latestWo.actionType, lang)} did not help. The drop matched the usual fade, and the spike may recur.`;
  } else if (latestWo?.status === 'in_progress') {
    subText = lang === 'hi'
      ? `${actionLabel(latestWo.actionType, lang)} जारी है। ${latestWo.agency} टीम ने काम शुरू कर दिया है।`
      : `${actionLabel(latestWo.actionType, lang)} is under way. The ${latestWo.agency} team started work.`;
  } else {
    subText = lang === 'hi'
      ? `संभावित कारण ${causeLabel(incident.topCause, lang)} है। अनुशंसित कार्रवाई नीचे तैयार है।`
      : `The likely cause is ${causeLabel(incident.topCause, lang).toLowerCase()}. Recommended action ready below.`;
  }

  const handleIssueWorkOrder = async (actionType?: any, agency?: any) => {
    setIsIssuing(true);
    try {
      const res = await issueWorkOrder(incident.id, { actionType, agency });
      setIncident(res.incident);
    } catch (err: any) {
      alert(err.message || 'Failed to issue work order');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleMeasureNow = async () => {
    if (!latestWo) return;
    setIsMeasuring(true);
    try {
      const measuredWo = await measureWorkOrder(latestWo.id);
      setIncident((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          workOrders: prev.workOrders.map((w) => (w.id === measuredWo.id ? measuredWo : w)),
          status: measuredWo.effect?.verdict === 'no_effect' ? 'recurred' : prev.status,
        };
      });
    } catch (err: any) {
      alert(err.message || 'Measurement not complete yet');
    } finally {
      setIsMeasuring(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href={`/board?dataset=${dataset}`}
          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-ink underline hover:opacity-80"
        >
          <span>&lt;</span>
          <span>{lang === 'hi' ? 'बोर्ड पर वापस' : 'Board'}</span>
        </Link>
      </div>

      {/* Top Banner: Incident Title + Large Slab */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b-2 border-ink pb-6">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 text-xs font-mono text-ink-3">
            <span>
              {lang === 'hi'
                ? `घटना · ${incident.area} · ${formatDateTimeRangeIST(incident.start, incident.end)}`
                : `Incident · ${incident.area} · ${formatDateTimeRangeIST(incident.start, incident.end)}`}
            </span>
            <StatusBadge status={incident.status} recurrenceCount={incident.recurrenceCount} variant="stamp" />
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-ink leading-tight">
            {lang === 'hi'
              ? `${pollutant} ${peakVal} तक पहुंच गया है, जो यहाँ के सामान्य स्तर से लगभग ${ratio} गुना है।`
              : `${pollutant} has reached ${peakVal}, about ${ratio} times the usual level here.`}
          </h1>

          <p className="font-sans text-sm sm:text-base text-ink-2 leading-relaxed">
            {subText}
          </p>
        </div>

        <div className="shrink-0">
          <BandPill value={peakVal} band={peakBand} pollutant={pollutant} variant="large" />
        </div>
      </div>

      {/* Loop Tracker */}
      <LoopTracker currentStep={currentStep} noLocalFix={isNoLocalFix} />

      {/* 5-Step Vertical Rail */}
      <div className="space-y-10 pl-2 sm:pl-6 border-l-2 border-ink/40">
        {/* STEP 1: DETECT */}
        <div className="relative space-y-3">
          <div className="absolute -left-[15px] sm:-left-[31px] top-1.5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center font-mono text-xs font-bold">
            ✓
          </div>
          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi' ? 'चरण 1 / 5 · पूरा हुआ' : 'Step 1 of 5 · done'}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'पहचान (Detect)' : 'Detect'}
          </h2>
          <p className="font-sans text-sm text-ink-2">
            {lang === 'hi'
              ? `${incident.start.slice(11, 16)} पर स्पाइक देखा गया। अधिकतम स्तर ${peakVal} µg/m³ रहा।`
              : `Spike detected at ${incident.start.slice(11, 16)}. Peaked at ${peakVal} µg/m³.`}
          </p>

          <ReadingChart
            readings={readings}
            incidents={[incident]}
            pollutant={pollutant === 'PM10' ? 'pm10' : 'pm25'}
            height={200}
            showToggles={false}
          />
          <Link
            href={`/area/${incident.stationId}?dataset=${dataset}`}
            className="inline-block font-mono text-xs font-bold underline text-ink"
          >
            {lang === 'hi' ? `${incident.area} के पिछले 48 घंटे →` : `Last 48 hours for ${incident.area} →`}
          </Link>
        </div>

        {/* STEP 2: DIAGNOSE */}
        <div className="relative space-y-4 pt-4 border-t border-rule">
          <div className="absolute -left-[15px] sm:-left-[31px] top-5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center font-mono text-xs font-bold">
            ✓
          </div>
          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi' ? 'चरण 2 / 5 · पूरा हुआ' : 'Step 2 of 5 · done'}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'कारण (Diagnose)' : 'Diagnose'}
          </h2>

          <CauseCard
            topCause={incident.topCause}
            confidence={incident.confidence}
            scores={incident.scores}
          />

          <div className="border border-ink bg-sheet p-4 space-y-2">
            <div className="text-xs font-mono uppercase font-bold text-ink-3">
              {lang === 'hi' ? `प्रमाण · ${incident.evidence.length} संकेत` : `EVIDENCE · ${incident.evidence.length} CLUES`}
            </div>
            {incident.evidence.map((chip, idx) => (
              <EvidenceRow key={chip.key} index={idx} chip={chip} />
            ))}
          </div>

          {/* Accordion: Other causes considered */}
          <div>
            <button
              onClick={() => setShowOtherCauses(!showOtherCauses)}
              className="font-mono text-xs font-bold underline text-ink flex items-center gap-1"
            >
              <span>
                {showOtherCauses
                  ? (lang === 'hi' ? '▼ छिपाएं' : '▼ Hide')
                  : (lang === 'hi' ? '▶ अन्य विचार किए गए कारण' : '▶ Other causes considered')}
              </span>
            </button>
            {showOtherCauses && (
              <div className="mt-2 p-3 border border-rule bg-paper space-y-1 font-mono text-xs">
                {(Object.entries(incident.scores) as [any, number][]).map(([c, score]) => (
                  <div key={c} className="flex justify-between py-1 border-b border-rule last:border-b-0">
                    <span className="capitalize">{causeLabel(c, lang)}</span>
                    <span className="font-bold">score {(score / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: PRESCRIBE */}
        <div className="relative space-y-4 pt-4 border-t border-rule">
          <div className="absolute -left-[15px] sm:-left-[31px] top-5 w-6 h-6 rounded-full bg-ink text-white flex items-center justify-center font-mono text-xs font-bold">
            ✓
          </div>
          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi' ? 'चरण 3 / 5 · पूरा हुआ' : 'Step 3 of 5 · done'}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'उपाय (Prescribe)' : 'Prescribe'}
          </h2>

          <RecommendationCard
            topCause={incident.topCause}
            actionType={isNoLocalFix ? 'public_advisory' : isDust ? 'water_sprinkling' : 'anti_burning_patrol'}
            agency={isNoLocalFix ? 'Residents' : isDust ? 'PWD' : 'MCD'}
            reason={PLAYBOOKS[incident.topCause]?.likelyEn || 'Likely local source.'}
            history={{ tried: 4, worked: 3, avgNetChangePct: -19 }}
          />
        </div>

        {/* STEP 4: ACT */}
        <div className="relative space-y-4 pt-4 border-t border-rule" id="act">
          <div
            className={`absolute -left-[15px] sm:-left-[31px] top-5 w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
              currentStep === 4 ? 'ring-2 ring-ink bg-paper text-ink font-bold' : currentStep > 4 ? 'bg-ink text-white' : 'bg-rule text-ink-3'
            }`}
          >
            {currentStep > 4 ? '✓' : '4'}
          </div>

          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi'
              ? `चरण 4 / 5 · ${currentStep === 4 ? 'अभी' : 'पूरा हुआ'}`
              : `Step 4 of 5 · ${currentStep === 4 ? 'now' : 'done'}`}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'कार्रवाई (Act)' : 'Act'}
          </h2>

          {latestWo ? (
            <WorkOrderCard workOrder={latestWo} />
          ) : (
            <div className="border border-ink bg-sheet p-6 space-y-4">
              <div className="text-xs font-mono font-bold uppercase text-ink-3">
                WO-DRAFT · {isNoLocalFix ? (lang === 'hi' ? 'जन सलाह' : 'PUBLIC ADVISORY') : (lang === 'hi' ? 'पानी का छिड़काव' : 'WATER SPRINKLING')}
              </div>
              <p className="font-sans text-sm text-ink leading-relaxed">
                {isNoLocalFix
                  ? lang === 'hi'
                    ? 'क्षेत्रीय धुएं के कारण दिल्ली भर में हवा गंभीर स्तर पर है। जन स्वास्थ्य सलाह जारी करें।'
                    : 'Air across Delhi is in the Severe band due to regional smoke. Issue public health advisory.'
                  : lang === 'hi'
                  ? `${incident.area} निगरानी स्टेशन के लगभग 1 किमी के दायरे में मुख्य सड़कों पर पानी का छिड़काव करें। फ़ील्ड पेज पर 'काम शुरू किया' और 'काम पूरा किया' दर्ज करें।`
                  : `Sprinkle the main roads within about 1 km of the ${incident.area} monitoring station. Tap Mark started and Mark done on the field page.`}
              </p>

              <button
                onClick={() => handleIssueWorkOrder()}
                disabled={isIssuing}
                className="w-full py-3 bg-ink text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-ink-2 transition-colors disabled:opacity-50"
              >
                {isIssuing
                  ? (lang === 'hi' ? 'कार्य आदेश जारी किया जा रहा है...' : 'Issuing work order...')
                  : isNoLocalFix
                  ? (lang === 'hi' ? 'जन सलाह जारी करें' : 'Issue public advisory')
                  : (lang === 'hi' ? 'कार्य आदेश जारी करें' : 'Issue work order')}
              </button>
              <div className="text-[11px] font-mono text-ink-3">
                {lang === 'hi'
                  ? 'डेमो: टीम के लिए एक फ़ील्ड लिंक बनाता है। कोई वास्तविक आदेश नहीं भेजा जाता।'
                  : 'DEMO: Creates a field link for the team. No real order is sent.'}
              </div>
            </div>
          )}
        </div>

        {/* STEP 5: PROVE */}
        <div className="relative space-y-4 pt-4 border-t border-rule" id="prove">
          <div
            className={`absolute -left-[15px] sm:-left-[31px] top-5 w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
              currentStep === 5 ? 'ring-2 ring-ink bg-paper text-ink' : 'border border-dashed border-ink-3 text-ink-3'
            }`}
          >
            5
          </div>

          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi'
              ? `चरण 5 / 5 · ${isNoLocalFix ? 'मापा नहीं गया' : latestWo?.effect ? 'पूरा हुआ' : 'अगला कदम'}`
              : `Step 5 of 5 · ${isNoLocalFix ? 'not measured' : latestWo?.effect ? 'done' : 'next'}`}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'परिणाम (Prove)' : 'Prove'}
          </h2>

          {isNoLocalFix ? (
            <div className="p-4 border border-rule bg-sheet text-ink-2 font-sans text-sm">
              {lang === 'hi'
                ? 'जन सलाह के लिए कुछ भी मापा नहीं जाता। Wajah रीडिंग पर नज़र रखता है और धुआँ छंटने पर सूचित करेगा।'
                : 'Nothing is measured for a public advisory. Wajah keeps watching the readings and will notify when smoke clears.'}
            </div>
          ) : latestWo ? (
            <div className="space-y-4">
              <EffectCard
                effect={latestWo.effect}
                checks={incident.checks}
                onMeasureNow={handleMeasureNow}
                isMeasuring={isMeasuring}
              />

              {/* If no effect: recommend alternative */}
              {latestWo.effect?.verdict === 'no_effect' && (
                <div className="p-4 border-2 border-ink bg-sheet space-y-3">
                  <div className="font-serif text-lg font-bold text-ink">
                    {lang === 'hi'
                      ? 'इससे कोई असर नहीं हुआ। अगला अनुशंसित उपाय: मशीन से सफाई।'
                      : 'This did not help. Recommended next: mechanical sweeping.'}
                  </div>
                  <p className="font-sans text-xs text-ink-2">
                    {lang === 'hi'
                      ? 'यहाँ पानी के छिड़काव का कोई असर नहीं हुआ। MCD द्वारा मशीन से सफाई की सिफारिश की जाती है।'
                      : 'Sprinkling has had no effect here. MCD sweeping is recommended next.'}
                  </p>
                  <button
                    onClick={() => handleIssueWorkOrder('mechanical_sweeping', 'MCD')}
                    disabled={isIssuing}
                    className="w-full py-2.5 bg-ink text-white font-mono text-xs font-bold uppercase tracking-wider"
                  >
                    {lang === 'hi' ? 'कार्य आदेश जारी करें: मशीन से सफाई' : 'Issue work order: mechanical sweeping'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 border border-dashed border-rule bg-paper font-sans text-sm text-ink-3">
              {lang === 'hi'
                ? 'फ़ील्ड टीम द्वारा काम पूरा करने के बाद माप शुरू होता है। इसके लिए काम के बाद 3 घंटे की रीडिंग की आवश्यकता होती है।'
                : 'Measuring starts when the field team marks the job done. It needs 3 hours of readings after the job.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
