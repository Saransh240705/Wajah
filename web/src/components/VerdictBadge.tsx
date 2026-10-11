'use client';

import React from 'react';
import type { Verdict } from '@wajah/shared';
import { useApp } from '../lib/context';
import { verdictLabel } from '../lib/i18n';
import { formatPct } from '../lib/utils';

interface VerdictBadgeProps {
  verdict: Verdict | string;
  netChangePct?: number | null;
  note?: string;
  className?: string;
}

export function VerdictBadge({
  verdict,
  netChangePct,
  note,
  className = '',
}: VerdictBadgeProps) {
  const { lang } = useApp();
  const label = verdictLabel(verdict, lang);

  if (verdict === 'worked') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-ink text-white font-mono text-xs font-bold ${className}`}
      >
        <span>✓</span>
        <span>{label}</span>
        {netChangePct != null && (
          <span className="opacity-90 pl-1 border-l border-white/40">
            {formatPct(netChangePct)}
          </span>
        )}
      </span>
    );
  }

  if (verdict === 'no_effect') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-ink text-white font-mono text-xs font-bold ${className}`}
      >
        <span>✕</span>
        <span>{label}</span>
        {netChangePct != null && (
          <span className="opacity-90 pl-1 border-l border-white/40">
            {formatPct(netChangePct)}
          </span>
        )}
      </span>
    );
  }

  if (verdict === 'inconclusive') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-transparent text-ink font-mono text-xs font-bold border border-dashed border-ink ${className}`}
      >
        <span>?</span>
        <span>{label}</span>
        {note && <span className="opacity-80 font-normal">· {note}</span>}
      </span>
    );
  }

  // not_measured
  return (
    <span className={`inline-flex items-center gap-1 text-ink-3 font-mono text-xs ${className}`}>
      <span>{label}</span>
    </span>
  );
}
