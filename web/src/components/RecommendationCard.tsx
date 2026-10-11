'use client';

import React from 'react';
import type { ActionType, Agency, Cause } from '@wajah/shared';
import { ACTIONS, PLAYBOOKS } from '@wajah/shared';
import { useApp } from '../lib/context';
import { actionLabel, reasonText } from '../lib/i18n';

interface RecommendationCardProps {
  topCause: Cause;
  actionType: ActionType;
  agency: Agency;
  reason: string;
  history?: { tried: number; worked: number; avgNetChangePct: number | null };
  className?: string;
}

export function RecommendationCard({
  topCause,
  actionType,
  agency,
  reason,
  history,
  className = '',
}: RecommendationCardProps) {
  const { lang } = useApp();
  const pb = PLAYBOOKS[topCause];
  const isNoLocalFix = !pb?.localActionPossible || actionType === 'public_advisory';

  const actionIcon = (type: ActionType) => {
    switch (type) {
      case 'water_sprinkling':
        return '💧';
      case 'mechanical_sweeping':
        return '🧹';
      case 'anti_burning_patrol':
        return '🛡';
      case 'traffic_management':
        return '🚦';
      case 'construction_inspection':
        return '📋';
      default:
        return '📢';
    }
  };

  if (isNoLocalFix) {
    return (
      <div className={`p-4 border border-ink bg-sheet ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">📢</span>
          <h3 className="font-serif text-xl sm:text-2xl font-extrabold text-ink">
            {lang === 'hi' ? 'कोई स्थानीय उपाय मदद नहीं करेगा।' : 'No local action will help.'}
          </h3>
        </div>

        <div className="mt-4 p-3 bg-ink text-white font-mono text-xs font-bold tracking-wide">
          <span className="bg-white text-ink px-1.5 py-0.5 mr-2 font-black">{lang === 'hi' ? 'बिल्कुल न करें' : 'DO NOT'}</span>
          <span>{lang === 'hi' ? 'इस स्थिति में पानी का छिड़काव न करें।' : 'Do not deploy sprinklers for this.'}</span>
        </div>

        <div className="mt-4 space-y-3 font-sans text-sm">
          <div className="border-b border-rule pb-2">
            <span className="text-xs font-mono uppercase text-ink-3 block">
              {lang === 'hi' ? 'कारण' : 'Why'}
            </span>
            <p className="text-ink mt-0.5 leading-relaxed">{lang === 'hi' ? (pb?.likelyHi ?? reasonText(reason, lang)) : (pb?.likelyEn ?? reason)}</p>
          </div>

          <div className="border-b border-rule pb-2">
            <span className="text-xs font-mono uppercase text-ink-3 block">
              {lang === 'hi' ? 'नागरिकों के लिए सलाह' : 'Advice for residents'}
            </span>
            <p className="text-ink mt-0.5 font-medium leading-relaxed">
              {lang === 'hi' ? pb?.adviceHi : pb?.adviceEn}
            </p>
          </div>

          <div>
            <span className="text-xs font-mono uppercase text-ink-3 block">
              {lang === 'hi' ? 'सुझाव' : 'Instead'}
            </span>
            <p className="text-ink mt-0.5">
              {lang === 'hi' ? 'जन सलाह जारी करें।' : 'Issue a public advisory.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Find alternative if available
  const altStep = pb?.steps && pb.steps.length > 1 ? pb.steps[1] : null;

  return (
    <div className={`p-4 border border-ink bg-sheet ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-xl">{actionIcon(actionType)}</span>
        <h3 className="font-serif text-xl sm:text-2xl font-extrabold text-ink">
          {actionLabel(actionType, lang)}
        </h3>
      </div>

      <div className="mt-4 space-y-2.5 font-sans text-sm">
        <div className="flex items-baseline justify-between border-b border-rule pb-2">
          <span className="text-xs font-mono uppercase text-ink-3">
            {lang === 'hi' ? 'ज़िम्मेदारी' : 'Agency'}
          </span>
          <span className="font-mono font-bold text-ink">{agency}</span>
        </div>

        <div className="border-b border-rule pb-2">
          <span className="text-xs font-mono uppercase text-ink-3 block">
            {lang === 'hi' ? 'क्यों' : 'Why'}
          </span>
          <p className="text-ink mt-0.5">{reasonText(reason, lang)}</p>
        </div>

        {history && (
          <div className="flex items-baseline justify-between border-b border-rule pb-2">
            <span className="text-xs font-mono uppercase text-ink-3">
              {lang === 'hi' ? 'यहाँ पिछला रिकॉर्ड' : 'History here'}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-ink">
                {history.tried > 0 ? (lang === 'hi' ? `${history.tried} में से ${history.worked} बार काम किया` : `Worked ${history.worked} of ${history.tried} times`) : (lang === 'hi' ? 'यहाँ अभी तक नहीं आजमाया गया' : 'Not tried here yet')}
              </span>
              {history.tried > 0 && (
                <div className="flex items-center gap-0.5 font-mono text-xs">
                  {Array.from({ length: history.tried }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block w-3 h-3 border border-ink ${
                        i < history.worked ? 'bg-ink' : 'bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {altStep && (
          <div className="pt-1 text-xs text-ink-3 font-sans">
            <span className="font-mono uppercase font-semibold">
              {lang === 'hi' ? 'यदि असर न हो:' : 'If it fails:'}
            </span>{' '}
            <span>
              {lang === 'hi' ? ACTIONS[altStep.actionType].labelHi : ACTIONS[altStep.actionType].labelEn}, {lang === 'hi' ? `${altStep.agency} के माध्यम से` : `through ${altStep.agency}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
