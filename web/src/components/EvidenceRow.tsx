'use client';

import React from 'react';
import type { EvidenceChip } from '@wajah/shared';
import { useApp } from '../lib/context';
import { chipLabel, chipTitle } from '../lib/i18n';

interface EvidenceRowProps {
  index: number;
  chip: EvidenceChip;
  className?: string;
}

export function EvidenceRow({ index, chip, className = '' }: EvidenceRowProps) {
  const { lang } = useApp();
  const letter = String.fromCharCode(65 + index); // A, B, C, D...
  const isSupports = chip.effect === 'supports';

  const markText = isSupports
    ? lang === 'hi' ? '+ पक्ष में' : '+ supports'
    : lang === 'hi' ? '− विपक्ष में' : '− weakens';

  return (
    <div
      className={`flex items-baseline justify-between py-2.5 border-b border-rule last:border-b-0 text-sm ${className}`}
    >
      <div className="flex items-baseline gap-3 pr-4">
        <span className="font-mono text-xs font-bold text-ink-3 shrink-0">{letter}</span>
        <div>
          <div className="text-xs font-mono uppercase text-ink-3">{chipTitle(chip.key, lang)}</div>
          <div className="font-sans font-semibold text-ink mt-0.5">{chipLabel(chip, lang)}</div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span
          className={`font-mono text-xs font-bold ${
            isSupports ? 'text-ink' : 'text-ink-2'
          }`}
        >
          {markText}
        </span>
      </div>
    </div>
  );
}
