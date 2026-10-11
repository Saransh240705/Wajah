'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AskResponse, StationSummary } from '@wajah/shared';
import { useApp } from '../../lib/context';
import { ask, getStations } from '../../lib/api';
import { EvidenceRow } from '../../components/EvidenceRow';

function AskContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataset, lang } = useApp();

  const [stations, setStations] = useState<StationSummary[]>([]);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState('');

  const sampleQuestions = [
    { text: 'Why was Anand Vihar so bad this afternoon?', stationId: 'anand-vihar' },
    { text: 'Is today\'s smoke from stubble burning?', stationId: 'all' },
    { text: 'जहाँगीरपुरी में कौन सा उपाय काम करता है?', stationId: 'jahangirpuri' },
    { text: 'आज सबसे पहले कहाँ टीम भेजें?', stationId: 'all' },
  ];

  const loadingSteps = [
    'Read the sensor readings for last night',
    'Looked at the wind and weather conditions',
    'Checking farm fires upwind with NASA FIRMS',
    'Looking up what has worked in the ledger',
    'Writing the answer with evidence chips',
  ];

  useEffect(() => {
    getStations(dataset).then(setStations);
    const stationIdParam = searchParams.get('stationId');
    if (stationIdParam) {
      setSelectedStation(stationIdParam);
    }
  }, [dataset, searchParams]);

  useEffect(() => {
    let timer: any;
    let stepTimer: any;
    if (loading) {
      setElapsed(0);
      setLoadingStep(0);
      timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
      stepTimer = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length);
      }, 3000);
    }
    return () => {
      clearInterval(timer);
      clearInterval(stepTimer);
    };
  }, [loading]);

  const handleSubmit = async (q: string, stationOverride?: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSubmittedQuery(q);
    setResponse(null);

    const stId = stationOverride || (selectedStation !== 'all' ? selectedStation : undefined);

    try {
      const res = await ask({
        mode: 'ask',
        message: q,
        stationId: stId,
        dataset,
        lang,
      });
      setResponse(res);
    } catch {
      setResponse({
        answer: 'Sorry, the agent could not answer at this moment. Please check the action board for current incidents.',
        evidence: [],
        suggestedActions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWriteBrief = async () => {
    setLoading(true);
    setSubmittedQuery('The brief for the next hour');
    setResponse(null);
    try {
      const res = await ask({
        mode: 'brief',
        dataset,
        lang,
      });
      setResponse(res);
    } catch {
      setResponse({
        answer: 'The brief could not be generated at this time.',
        evidence: [],
        suggestedActions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div>
        <div className="text-xs font-mono font-bold tracking-wider text-ink-3 uppercase">
          Ask Wajah
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-ink mt-2 leading-tight">
          Ask why the air turned bad, or what to do next.
        </h1>
        <p className="font-sans text-sm sm:text-base text-ink-2 mt-2 leading-relaxed">
          Wajah reads the sensors, the wind and the ledger, then answers with its evidence. Ask in English or Hindi.
        </p>
      </div>

      {/* Try one of these questions */}
      {!response && !loading && (
        <div className="space-y-4">
          <div className="text-xs font-mono font-bold uppercase text-ink-3">
            TRY ONE OF THESE
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sampleQuestions.map((sq, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(sq.text);
                  setSelectedStation(sq.stationId);
                  handleSubmit(sq.text, sq.stationId === 'all' ? undefined : sq.stationId);
                }}
                className="text-left p-4 border border-ink bg-sheet hover:bg-paper transition-colors flex items-center justify-between group"
              >
                <span className="font-serif font-bold text-sm text-ink group-hover:underline">
                  {sq.text}
                </span>
                <span className="font-mono text-base text-ink shrink-0 ml-2">→</span>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button
              onClick={handleWriteBrief}
              className="w-full py-3 border-2 border-ink bg-paper text-ink font-serif text-base font-bold flex items-center justify-center gap-2 hover:bg-sheet transition-colors"
            >
              <span>✍</span>
              <span>Write the brief</span>
            </button>
            <p className="text-center font-sans text-xs text-ink-3 mt-1.5">
              The same brief as on the board: what to do in the next hour, and one thing not to do.
            </p>
          </div>
        </div>
      )}

      {/* Loading state animation */}
      {loading && (
        <div className="p-6 border-2 border-ink bg-sheet space-y-6">
          <div>
            <div className="text-xs font-mono text-ink-3">You asked:</div>
            <div className="font-serif font-bold text-xl text-ink mt-1">{submittedQuery}</div>
          </div>

          <div className="space-y-3">
            <div className="font-serif text-lg font-bold text-ink">
              {loadingSteps[loadingStep]}…
            </div>
            <div className="w-full bg-rule h-1.5">
              <div
                className="bg-ink h-1.5 transition-all duration-300"
                style={{ width: `${Math.min(95, elapsed * 6)}%` }}
              />
            </div>
            <div className="font-mono text-xs text-ink-3">{elapsed}s of about 20s</div>
          </div>

          <div className="space-y-2 font-mono text-xs text-ink-2 pt-2 border-t border-rule">
            {loadingSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span>{idx < loadingStep ? '✓' : idx === loadingStep ? '■' : '□'}</span>
                <span className={idx === loadingStep ? 'font-bold text-ink' : ''}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer card with evidence & direct actions */}
      {response && !loading && (
        <div className="space-y-6">
          <div className="p-6 border-2 border-ink bg-sheet space-y-6">
            <div>
              <div className="text-xs font-mono text-ink-3">
                {lang === 'hi' ? 'आपने पूछा · ' : 'You asked · '}
                <span className="font-bold text-ink">{selectedStation === 'all' ? 'All Delhi' : selectedStation}</span>
              </div>
              <h2 className="font-serif font-extrabold text-2xl text-ink mt-1">
                {submittedQuery}
              </h2>
            </div>

            <div className="font-sans text-base text-ink leading-relaxed whitespace-pre-line border-t border-b border-rule py-4">
              {response.answer}
            </div>

            {/* Evidence Chips */}
            {response.evidence && response.evidence.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-mono uppercase font-bold text-ink-3">
                  {lang === 'hi' ? 'सबूत (EVIDENCE)' : 'EVIDENCE'}
                </div>
                <div className="border border-rule divide-y divide-rule p-2">
                  {response.evidence.map((chip, idx) => (
                    <EvidenceRow key={chip.key || idx} index={idx} chip={chip} />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested actions */}
            <div className="pt-2 flex flex-wrap gap-3">
              {response.incidentId && (
                <button
                  onClick={() => router.push(`/incident/${response.incidentId}?dataset=${dataset}`)}
                  className="px-4 py-2 bg-ink text-white font-mono text-xs font-bold uppercase hover:bg-ink-2"
                >
                  {lang === 'hi' ? 'घटना खोलें' : 'Open incident'}
                </button>
              )}
              <button
                onClick={() => router.push(`/board?dataset=${dataset}`)}
                className="px-4 py-2 border border-ink bg-paper font-mono text-xs font-bold uppercase hover:bg-ink hover:text-white"
              >
                {lang === 'hi' ? 'बोर्ड खोलें' : 'Open board'}
              </button>
              <button
                onClick={() => {
                  setResponse(null);
                  setQuery('');
                }}
                className="px-4 py-2 border border-rule font-mono text-xs font-bold uppercase hover:border-ink"
              >
                {lang === 'hi' ? 'नया सवाल पूछें' : 'Ask another question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Form */}
      <div className="sticky bottom-20 md:bottom-6 bg-paper p-2 border-2 border-ink bg-sheet shadow-sm space-y-2">
        <div className="flex items-center gap-2 px-2 text-xs font-mono text-ink-2">
          <span>Area:</span>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="bg-paper border border-rule px-1.5 py-0.5 font-mono text-xs text-ink focus:outline-none"
          >
            <option value="all">All Delhi</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(query);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === 'hi' ? 'आगे पूछें...' : 'Ask why or what to do...'}
            disabled={loading}
            className="flex-1 px-3 py-2.5 bg-paper border border-rule text-sm font-sans text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-ink text-white font-mono text-base font-bold hover:bg-ink-2 disabled:opacity-50 transition-colors"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto p-8 font-mono text-xs text-ink-3">
          Loading Ask Wajah…
        </div>
      }
    >
      <AskContent />
    </Suspense>
  );
}
