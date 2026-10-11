'use client';

import React from 'react';
import type { Cause, Confidence } from '@wajah/shared';
import { useApp } from '../lib/context';
import { causeLabel } from '../lib/i18n';

interface CauseCardProps {
  topCause: Cause;
  confidence: Confidence;
  scores?: Record<Cause, number>;
  className?: string;
}

export function CauseCard({ topCause, confidence, scores, className = '' }: CauseCardProps) {
  const { lang } = useApp();
  const isUnclear = confidence === 'low';

  const causeIcon = (cause: Cause) => {
    switch (cause) {
      case 'dust':
        return '∴';
      case 'local_burning':
        return '♨';
      case 'traffic':
        return '🚗';
      case 'regional_smoke':
        return '≈';
      case 'trapped_air':
        return '☁';
      default:
        return '?';
    }
  };

  const confidenceSquares = (conf: Confidence) => {
    if (conf === 'high') {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <span className="text-ink">■■■</span>
          <span className="font-semibold text-ink ml-1">{lang === 'hi' ? 'भरोसा: उच्च' : 'Confidence: high'}</span>
        </span>
      );
    }
    if (conf === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <span className="text-ink">■■□</span>
          <span className="font-semibold text-ink ml-1">{lang === 'hi' ? 'भरोसा: मध्यम' : 'Confidence: medium'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs">
        <span className="text-ink">■□□</span>
        <span className="font-semibold text-ink-3 ml-1">{lang === 'hi' ? 'भरोसा: कम' : 'Confidence: low'}</span>
      </span>
    );
  };

  if (isUnclear) {
    // Sort causes by score to show top 2
    const sorted = scores
      ? (Object.entries(scores) as [Cause, number][]).sort((a, b) => b[1] - a[1])
      : [];
    const candidate1 = sorted[0];
    const candidate2 = sorted[1];

    return (
      <div className={`p-4 border border-dashed border-ink bg-sheet ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">?</span>
          <h3 className="font-serif text-xl font-extrabold text-ink">
            {lang === 'hi' ? 'कारण स्पष्ट नहीं' : 'Cause unclear'}
          </h3>
        </div>
        <div className="mt-1">{confidenceSquares('low')}</div>
        <p className="font-sans text-sm text-ink-2 mt-2 leading-relaxed">
          {lang === 'hi'
            ? 'दो कारण लगभग समान रूप से संभावित हैं। जब संकेत विभाजित हों तो Wajah अनुमान नहीं लगाता।'
            : 'Two causes fit about equally well. Wajah does not pick one when the clues disagree.'}
        </p>

        {candidate1 && candidate2 && (
          <div className="mt-4 pt-3 border-t border-rule space-y-2">
            <div className="text-xs font-mono uppercase font-bold text-ink-3">
              {lang === 'hi' ? 'दो प्रमुख संभावनाएँ' : 'THE TWO LEADING CANDIDATES'}
            </div>
            <div className="flex items-center justify-between font-mono text-sm py-1 border-b border-rule">
              <span>{causeLabel(candidate1[0], lang)}</span>
              <span className="font-bold">{lang === 'hi' ? 'स्कोर' : 'score'} {(candidate1[1] / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-sm py-1">
              <span>{causeLabel(candidate2[0], lang)}</span>
              <span className="font-bold">{lang === 'hi' ? 'स्कोर' : 'score'} {(candidate2[1] / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 border border-ink bg-sheet ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{causeIcon(topCause)}</span>
        <h3 className="font-serif text-xl sm:text-2xl font-extrabold text-ink">
          {causeLabel(topCause, lang)}
        </h3>
      </div>
      <div className="mt-2">{confidenceSquares(confidence)}</div>
    </div>
  );
}
