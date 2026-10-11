'use client';

import React from 'react';
import type { EffectResult, VerifyCheck } from '@wajah/shared';
import { useApp } from '../lib/context';
import { formatPct, formatTimeIST } from '../lib/utils';
import { BandPill } from './BandPill';

interface EffectCardProps {
  effect?: EffectResult;
  checks?: VerifyCheck[];
  onMeasureNow?: () => void;
  isMeasuring?: boolean;
  className?: string;
}

export function EffectCard({
  effect,
  checks = [],
  onMeasureNow,
  isMeasuring = false,
  className = '',
}: EffectCardProps) {
  const { lang } = useApp();

  if (!effect) {
    return (
      <div className={`p-4 border border-ink bg-sheet ${className}`}>
        <div className="text-xs font-mono uppercase font-bold text-ink-3">
          {lang === 'hi' ? 'निर्णय · अभी नहीं' : 'VERDICT · NOT YET'}
        </div>
        <h3 className="font-serif text-2xl font-extrabold text-ink mt-1">
          {lang === 'hi' ? 'मापा जा रहा है...' : 'Measuring.'}
        </h3>
        <p className="font-sans text-sm text-ink-2 mt-2 leading-relaxed">
          {lang === 'hi'
            ? 'काम पूरा होने के बाद 3 घंटे के सेंसर डेटा की आवश्यकता होती है।'
            : 'Needs 3 hours of readings after the job to judge effect.'}
        </p>

        {onMeasureNow && (
          <button
            onClick={onMeasureNow}
            disabled={isMeasuring}
            className="mt-4 px-4 py-2 bg-ink text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-ink-2 transition-colors disabled:opacity-50"
          >
            {isMeasuring ? (lang === 'hi' ? 'माप रहे हैं...' : 'Measuring...') : (lang === 'hi' ? 'अभी मापें' : 'Measure now')}
          </button>
        )}
      </div>
    );
  }

  const isWorked = effect.verdict === 'worked';
  const isNoEffect = effect.verdict === 'no_effect';
  const isInconclusive = effect.verdict === 'inconclusive';

  return (
    <div className={`p-4 border border-ink bg-sheet ${className}`}>
      {/* Verdict Header */}
      <div className="border-b border-rule pb-3">
        <div className="text-xs font-mono uppercase font-bold text-ink-3">
          {lang === 'hi' ? `निर्णय · मापा गया ${formatTimeIST(effect.measuredAt)}` : `VERDICT · MEASURED ${formatTimeIST(effect.measuredAt)}`}
        </div>
        <div className="mt-2">
          {isWorked && (
            <div className="p-3 bg-ink text-white font-serif text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <span>✓</span>
              <span>{lang === 'hi' ? 'असर हुआ' : 'Worked'}</span>
            </div>
          )}
          {isNoEffect && (
            <div className="p-3 bg-ink text-white font-serif text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <span>✕</span>
              <span>{lang === 'hi' ? 'असर नहीं हुआ' : 'No effect'}</span>
            </div>
          )}
          {isInconclusive && (
            <div className="p-3 border-2 border-dashed border-ink bg-paper text-ink font-serif text-2xl font-extrabold flex items-center gap-2">
              <span>?</span>
              <span>{lang === 'hi' ? 'स्पष्ट नहीं' : 'Inconclusive'}</span>
            </div>
          )}
        </div>
        <p className="font-sans text-sm text-ink-2 mt-2">
          {isWorked
            ? (lang === 'hi'
                ? `${effect.pollutant.toUpperCase()} सामान्य गिरावट की तुलना में ${Math.abs(Math.round(effect.netChangePct))}% अधिक कम हुआ।`
                : `${effect.pollutant.toUpperCase()} fell ${Math.abs(Math.round(effect.netChangePct))}% more than spikes here usually fade on their own.`)
            : isNoEffect
            ? (lang === 'hi'
                ? 'कमी बिना किसी कार्रवाई के होने वाली सामान्य गिरावट के बराबर थी।'
                : 'The drop matched the usual fade when nobody acts.')
            : (effect.note || (lang === 'hi' ? 'सेंसर डेटा या स्थितियाँ अनिर्णायक थीं।' : 'Sensor data or conditions were inconclusive.'))}
        </p>
      </div>

      {/* 4 Numbers Grid */}
      <div className="py-4 border-b border-rule grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-2 border border-rule bg-paper">
          <div className="text-[11px] font-mono text-ink-3 uppercase">{lang === 'hi' ? 'पहले' : 'Before'}</div>
          <div className="font-slab text-2xl font-normal text-ink mt-1">{Math.round(effect.beforeMean)}</div>
          <BandPill value={Math.round(effect.beforeMean)} variant="legend" className="mt-1" />
        </div>

        <div className="p-2 border border-rule bg-paper">
          <div className="text-[11px] font-mono text-ink-3 uppercase">{lang === 'hi' ? 'बाद में' : 'After'}</div>
          <div className="font-slab text-2xl font-normal text-ink mt-1">{Math.round(effect.afterMean)}</div>
          <BandPill value={Math.round(effect.afterMean)} variant="legend" className="mt-1" />
        </div>

        <div className="p-2 border border-rule bg-paper">
          <div className="text-[11px] font-mono text-ink-3 uppercase">{lang === 'hi' ? 'अपेक्षित गिरावट' : 'Expected fade'}</div>
          <div className="font-slab text-2xl font-normal text-ink mt-1">{formatPct(effect.expectedChangePct)}</div>
          <div className="text-[10px] font-mono text-ink-3 mt-1">{lang === 'hi' ? 'बिना कार्रवाई के' : 'if nobody acts'}</div>
        </div>

        <div className="p-2 border-2 border-ink bg-paper">
          <div className="text-[11px] font-mono font-bold text-ink uppercase">{lang === 'hi' ? 'शुद्ध बदलाव' : 'Net change'}</div>
          <div className="font-slab text-2xl font-normal text-ink mt-1">
            {isInconclusive ? (lang === 'hi' ? 'आकलन नहीं' : 'Not judged') : formatPct(effect.netChangePct)}
          </div>
          <div className="text-[10px] font-mono text-ink-3 mt-1">
            {isInconclusive ? '—' : `${formatPct(effect.changePct)} ${lang === 'hi' ? 'घटाकर' : 'less'} ${formatPct(effect.expectedChangePct)}`}
          </div>
        </div>
      </div>

      <div className="py-2 text-xs font-sans text-ink-3">
        {lang === 'hi'
          ? 'सफलता का अर्थ सामान्य गिरावट के अतिरिक्त 15% या अधिक की शुद्ध कमी है।'
          : 'Worked means a net drop of 15% or more after taking off the usual fade.'}
      </div>

      {/* Later nights check timeline */}
      <div className="mt-4 pt-3 border-t border-rule">
        <div className="text-xs font-mono uppercase font-bold text-ink-3 mb-2">
          {lang === 'hi' ? 'क्या प्रदूषण दोबारा बढ़ा?' : 'DID IT STAY AWAY'}
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          {checks.length > 0 ? (
            checks.map((c, i) => (
              <div key={i} className="p-2 border border-rule bg-paper">
                <div className="font-bold text-ink">{c.date}</div>
                <div className="text-ink-2 mt-0.5 capitalize">
                  {c.result === 'clean' ? (lang === 'hi' ? '✓ साफ़' : '✓ Clean') : (lang === 'hi' ? `⟲ दोबारा बढ़ा (शीर्ष ${c.peakPm25})` : `⟲ Recurred (peak ${c.peakPm25})`)}
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="p-2 border border-dashed border-rule bg-paper text-ink-3">
                <div>{lang === 'hi' ? 'अगली रात 1' : 'Later night 1'}</div>
                <div className="mt-0.5">{lang === 'hi' ? 'जाँच बाकी' : 'Not yet checked'}</div>
              </div>
              <div className="p-2 border border-dashed border-rule bg-paper text-ink-3">
                <div>{lang === 'hi' ? 'अगली रात 2' : 'Later night 2'}</div>
                <div className="mt-0.5">{lang === 'hi' ? 'जाँच बाकी' : 'Not yet checked'}</div>
              </div>
            </>
          )}
        </div>
        <div className="text-[11px] font-sans text-ink-3 mt-2">
          {lang === 'hi'
            ? 'समान घंटों में बिना किसी उछाल के लगातार दो साफ़ रातों के बाद इस घटना को साफ़ (Cleared) चिह्नित किया जाता है।'
            : 'The incident is marked Cleared after two consecutive clean nights without a spike in the same hours.'}
        </div>
      </div>
    </div>
  );
}
