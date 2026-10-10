'use client';

import React from 'react';
import { useApp } from '../lib/context';
import { t } from '../lib/i18n';

interface LoopTrackerProps {
  currentStep: number; // 1 to 5
  noLocalFix?: boolean;
  className?: string;
}

export function LoopTracker({ currentStep, noLocalFix = false, className = '' }: LoopTrackerProps) {
  const { lang } = useApp();

  const steps = [
    { num: 1, key: 'step_detect', label: t('step_detect', lang) },
    { num: 2, key: 'step_diagnose', label: t('step_diagnose', lang) },
    { num: 3, key: 'step_prescribe', label: t('step_prescribe', lang) },
    { num: 4, key: 'step_act', label: t('step_act', lang) },
    { num: 5, key: 'step_prove', label: t('step_prove', lang), notUsed: noLocalFix },
  ];

  return (
    <div className={`w-full border-b border-ink bg-paper ${className}`}>
      {/* Laptop / desktop view */}
      <div className="hidden sm:grid grid-cols-5 text-center text-xs font-mono font-bold tracking-wide">
        {steps.map((step) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;
          const isNotYet = currentStep < step.num;

          return (
            <div
              key={step.num}
              className={`py-2 px-3 border-r border-ink last:border-r-0 flex items-center justify-center gap-1.5 transition-colors ${
                isCurrent
                  ? 'bg-ink text-paper'
                  : isDone
                  ? 'bg-paper text-ink font-semibold'
                  : 'bg-paper text-ink-3 font-normal'
              }`}
            >
              {isDone ? (
                <span className="text-xs">✓</span>
              ) : (
                <span className="text-xs font-mono">{step.num}</span>
              )}
              <span className="capitalize">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Mobile view */}
      <div className="sm:hidden flex items-center justify-between px-3 py-2 text-xs font-mono">
        {steps.map((step) => {
          const isDone = currentStep > step.num;
          const isCurrent = currentStep === step.num;

          return (
            <div
              key={step.num}
              className={`flex items-center gap-1 px-1.5 py-0.5 ${
                isCurrent
                  ? 'bg-ink text-paper font-bold'
                  : isDone
                  ? 'text-ink font-semibold'
                  : 'text-ink-3'
              }`}
            >
              {isDone ? (
                <span>✓</span>
              ) : isCurrent ? (
                <span>{step.num}</span>
              ) : null}
              <span className="text-[11px]">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
