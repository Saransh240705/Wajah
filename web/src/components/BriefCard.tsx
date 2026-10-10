'use client';

import React, { useState } from 'react';
import type { AskResponse } from '@wajah/shared';
import { useApp } from '../lib/context';
import { ask } from '../lib/api';

interface BriefCardProps {
  initialBrief?: AskResponse | null;
  className?: string;
}

export function BriefCard({ initialBrief, className = '' }: BriefCardProps) {
  const { lang, dataset } = useApp();
  const [brief, setBrief] = useState<AskResponse | null>(initialBrief || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBrief = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await ask({ mode: 'brief', dataset, lang });
      setBrief(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const currentHour = new Date().getHours();
  const nextHour = (currentHour + 1) % 24;
  const timeHeader = `${currentHour}:00 TO ${nextHour}:00`;

  return (
    <div className={`p-4 border-2 border-ink bg-sheet ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule pb-2.5">
        <div className="text-xs font-mono font-bold tracking-wider text-ink uppercase">
          {lang === 'hi' ? `अगले घंटे की रिपोर्ट (${timeHeader})` : `BRIEF FOR ${timeHeader}`}
        </div>
        <button
          onClick={fetchBrief}
          disabled={loading}
          className="font-mono text-xs text-ink font-semibold flex items-center gap-1 hover:underline disabled:opacity-50"
        >
          <span>↻</span>
          <span>{lang === 'hi' ? 'ताज़ा करें' : 'Refresh'}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block animate-spin text-xl text-ink">⏳</div>
          <div className="font-sans text-sm font-semibold text-ink mt-2">
            {lang === 'hi' ? 'रिपोर्ट तैयार की जा रही है...' : 'Writing the brief from the rows below…'}
          </div>
          <div className="font-mono text-xs text-ink-3 mt-1">About 10 seconds.</div>
        </div>
      ) : error ? (
        <div className="py-4">
          <div className="text-sm font-serif font-bold text-ink">
            {lang === 'hi' ? 'संक्षिप्त रिपोर्ट तैयार नहीं हो सकी।' : 'The brief could not be written this time.'}
          </div>
          <div className="text-xs font-sans text-ink-2 mt-1">
            {lang === 'hi'
              ? 'नीचे दिए गए आंकड़े ताज़ा हैं, आप उनके अनुसार कार्रवाई कर सकते हैं।'
              : 'The ranked rows below are still current, so you can work from them.'}
          </div>
          <button
            onClick={fetchBrief}
            className="mt-3 px-3 py-1 bg-ink text-white font-mono text-xs font-bold uppercase"
          >
            {lang === 'hi' ? 'पुनः प्रयास करें' : 'Try again'}
          </button>
        </div>
      ) : brief ? (
        <div className="py-3 space-y-3 font-sans text-sm">
          <div className="whitespace-pre-line text-ink leading-relaxed font-sans">
            {brief.answer}
          </div>

          <div className="pt-2 border-t border-rule text-[11px] font-mono text-ink-3">
            Written by Wajah agent from sensor readings and ledger history.
          </div>
        </div>
      ) : (
        <div className="py-3">
          <p className="font-sans text-sm text-ink-2">
            {lang === 'hi'
              ? 'कंट्रोल रूम की वर्तमान प्राथमिकताओं के लिए संक्षिप्त रिपोर्ट तैयार करें।'
              : 'Generate an AI summary of recommended actions for this hour.'}
          </p>
          <button
            onClick={fetchBrief}
            className="mt-3 px-3 py-1.5 bg-ink text-white font-mono text-xs font-bold uppercase hover:bg-ink-2 transition-colors"
          >
            {lang === 'hi' ? 'संक्षिप्त रिपोर्ट लिखें' : 'Write the brief'}
          </button>
        </div>
      )}
    </div>
  );
}
