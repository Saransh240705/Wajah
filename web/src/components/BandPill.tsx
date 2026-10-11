'use client';

import React from 'react';
import type { AqiBand } from '@wajah/shared';
import { bandBgClass } from '../lib/utils';
import { bandLabel } from '../lib/i18n';
import { useApp } from '../lib/context';

interface BandPillProps {
  value: number | string | null;
  band?: AqiBand | string | null;
  pollutant?: string;
  variant?: 'compact' | 'large' | 'legend' | 'slab';
  className?: string;
}

export function BandPill({
  value,
  band = 'moderate',
  pollutant = 'PM2.5',
  variant = 'compact',
  className = '',
}: BandPillProps) {
  const { lang } = useApp();
  const bg = bandBgClass(band);
  const capitalizedBand = bandLabel(band, lang);

  if (variant === 'legend') {
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-mono uppercase font-semibold ${bg} ${className}`}>
        {capitalizedBand}
      </span>
    );
  }

  if (variant === 'large') {
    return (
      <div className={`p-4 border border-ink ${bg} ${className}`}>
        <div className="text-xs font-mono uppercase tracking-widest opacity-80">
          {lang === 'hi' ? 'अभी' : 'NOW'}
        </div>
        <div className="font-slab text-5xl sm:text-6xl font-normal leading-none mt-1">{value ?? '--'}</div>
        <div className="font-serif text-lg font-extrabold capitalize mt-2">{capitalizedBand}</div>
        <div className="text-xs font-mono opacity-90 mt-0.5">
          {pollutant}, µg/m³
        </div>
      </div>
    );
  }

  if (variant === 'slab') {
    return (
      <div className={`inline-flex items-center border border-ink ${className}`}>
        <div className={`px-2.5 py-1 font-mono font-bold text-sm ${bg}`}>
          {value ?? '--'}
        </div>
        <div className="px-2 py-1 bg-paper text-ink text-xs font-mono capitalize border-l border-ink">
          {capitalizedBand}
        </div>
      </div>
    );
  }

  // compact
  return (
    <div className={`inline-flex flex-col items-center justify-center p-1.5 min-w-[52px] text-center border border-ink/20 ${bg} ${className}`}>
      <span className="font-mono font-bold text-base leading-none">{value ?? '--'}</span>
      <span className="text-[10px] font-mono capitalize tracking-tight mt-0.5 leading-none">
        {capitalizedBand}
      </span>
    </div>
  );
}
