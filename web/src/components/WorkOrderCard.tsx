'use client';

import React, { useState } from 'react';
import type { WorkOrder } from '@wajah/shared';
import { useApp } from '../lib/context';
import { StepTimeline } from './StepTimeline';
import { formatTimeIST } from '../lib/utils';
import { actionLabel, instructionsText } from '../lib/i18n';
import { VerdictBadge } from './VerdictBadge';

interface WorkOrderCardProps {
  workOrder: WorkOrder;
  className?: string;
}

export function WorkOrderCard({ workOrder, className = '' }: WorkOrderCardProps) {
  const { lang, dataset } = useApp();
  const [instLang, setInstLang] = useState<'en' | 'hi'>('en');
  const [copied, setCopied] = useState(false);

  const copyFieldLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/work-order/${workOrder.id}?dataset=${dataset}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isIssued = !!workOrder.issuedAt;
  const isInProgress = !!workOrder.startedAt;
  const isDone = !!workOrder.doneAt;

  return (
    <div className={`p-4 border border-ink bg-sheet ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm tracking-wider text-ink">
            {workOrder.id.toUpperCase()}
          </span>
          {workOrder.demo && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold uppercase border border-ink text-ink">
              DEMO
            </span>
          )}
        </div>
        <div className="font-sans text-xs font-semibold text-ink-2">
          {actionLabel(workOrder.actionType, lang)} · {workOrder.agency}
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="py-4 border-b border-rule">
        <StepTimeline
          steps={[
            { label: lang === 'hi' ? 'जारी किया गया' : 'Issued', time: formatTimeIST(workOrder.issuedAt) || '--', reached: true },
            {
              label: lang === 'hi' ? 'प्रगति पर' : 'In progress',
              time: workOrder.startedAt ? formatTimeIST(workOrder.startedAt) : (lang === 'hi' ? 'अभी नहीं' : 'not yet'),
              reached: isInProgress || isDone,
            },
            {
              label: lang === 'hi' ? 'पूर्ण' : 'Done',
              time: isDone ? formatTimeIST(workOrder.doneAt) : (lang === 'hi' ? 'अभी नहीं' : 'not yet'),
              reached: isDone,
            },
          ]}
        />
      </div>

      {/* Instructions */}
      <div className="py-3 border-b border-rule">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono font-bold uppercase text-ink-3">
            {lang === 'hi' ? 'निर्देश' : 'INSTRUCTIONS'}
          </span>
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => setInstLang('en')}
              className={`${instLang === 'en' ? 'font-bold underline text-ink' : 'text-ink-3'}`}
            >
              English
            </button>
            <span>·</span>
            <button
              onClick={() => setInstLang('hi')}
              className={`${instLang === 'hi' ? 'font-bold underline text-ink' : 'text-ink-3'}`}
            >
              हिंदी
            </button>
          </div>
        </div>
        <p className="font-sans text-sm text-ink leading-relaxed">
          {instructionsText(workOrder, instLang)}
        </p>
      </div>

      {/* Photo check if present */}
      {workOrder.photo && (
        <div className="py-3 border-b border-rule flex items-start gap-3 bg-fill/30 p-2.5">
          <span className="text-lg">📷</span>
          <div className="text-xs font-sans">
            <span className="font-mono uppercase font-bold text-ink mr-1">
              {lang === 'hi'
                ? `फ़ोटो सत्यापन: ${workOrder.photo.result === 'pass' ? 'सफल' : workOrder.photo.result === 'fail' ? 'विफल' : 'अस्पष्ट'}`
                : `Photo check: ${workOrder.photo.result}`}
            </span>
            <span className="text-ink-2">{workOrder.photo.note}</span>
          </div>
        </div>
      )}

      {/* Result if measured */}
      {workOrder.effect && (
        <div className="pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-mono uppercase font-bold text-ink-3">
            {lang === 'hi' ? 'परिणाम' : 'RESULT'}
          </span>
          <VerdictBadge
            verdict={workOrder.effect.verdict}
            netChangePct={workOrder.effect.netChangePct}
          />
        </div>
      )}

      {/* Field link button */}
      <div className="mt-3 pt-2 flex items-center justify-between">
        <button
          onClick={copyFieldLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink bg-paper text-ink font-mono text-xs font-bold hover:bg-ink hover:text-paper transition-colors"
        >
          <span>📋</span>
          <span>{copied ? (lang === 'hi' ? 'कॉपी हो गया!' : 'Link copied!') : (lang === 'hi' ? 'फ़ील्ड लिंक कॉपी करें' : 'Copy field link')}</span>
        </button>
        <a
          href={`/work-order/${workOrder.id}?dataset=${dataset}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono font-semibold text-ink underline hover:opacity-80"
        >
          {lang === 'hi' ? 'फ़ील्ड पेज खोलें ↗' : 'Open field view ↗'}
        </a>
      </div>
    </div>
  );
}
