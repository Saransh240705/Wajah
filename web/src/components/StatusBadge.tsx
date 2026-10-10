'use client';

import React from 'react';
import type { IncidentStatus } from '@wajah/shared';
import { useApp } from '../lib/context';
import { statusLabel } from '../lib/i18n';

interface StatusBadgeProps {
  status: IncidentStatus | string;
  recurrenceCount?: number;
  variant?: 'stamp' | 'compact';
  className?: string;
}

export function StatusBadge({
  status,
  recurrenceCount = 0,
  variant = 'compact',
  className = '',
}: StatusBadgeProps) {
  const { lang } = useApp();
  const label = statusLabel(status, lang);

  if (status === 'recurred') {
    const countStr = recurrenceCount > 1 ? ` ×${recurrenceCount}` : recurrenceCount === 1 ? ' ×2' : '';
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 bg-ink text-paper font-mono text-xs font-bold tracking-wider ${
          variant === 'stamp' ? 'border border-ink shadow-none transform -rotate-1' : ''
        } ${className}`}
      >
        <span>⟲</span>
        <span>{label}{countStr}</span>
      </span>
    );
  }

  if (status === 'dispatched') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 bg-paper text-ink font-mono text-xs font-bold tracking-wider border-2 border-ink ${
          variant === 'stamp' ? 'transform rotate-1' : ''
        } ${className}`}
      >
        <span>⊲</span>
        <span>{label}</span>
      </span>
    );
  }

  if (status === 'cleared') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-ink font-mono text-xs font-bold tracking-wider border-b-2 border-ink ${className}`}
      >
        <span>✓</span>
        <span>{label}</span>
      </span>
    );
  }

  // open
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 bg-paper text-ink font-mono text-xs font-bold tracking-wider border border-ink ${
        variant === 'stamp' ? 'transform -rotate-1' : ''
      } ${className}`}
    >
      <span className="w-1.5 h-1.5 bg-ink inline-block" />
      <span>{label}</span>
    </span>
  );
}
