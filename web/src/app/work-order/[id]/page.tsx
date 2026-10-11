'use client';

import React, { useEffect, useState, use } from 'react';
import type { Incident, WorkOrder } from '@wajah/shared';
import { useApp } from '../../../lib/context';
import { StepTimeline } from '../../../components/StepTimeline';
import { getWorkOrder } from '../../../lib/api';
import { FieldActionButtons } from '../../../components/FieldActionButtons';
import { actionLabel, areaLabel, instructionsText, reasonText } from '../../../lib/i18n';
import { formatTimeIST } from '../../../lib/utils';

export default function WorkOrderFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { lang, setLang } = useApp();

  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkOrder(resolvedParams.id);
      setWorkOrder(data.workOrder);
      setIncident(data.incident);
    } catch (err: any) {
      setError(err.message || 'Work order not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Default field view to Hindi as shown in spec
    setLang('hi');
    loadData();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-rule" />
        <div className="h-12 w-48 bg-rule" />
        <div className="h-40 bg-rule" />
        <div className="h-32 bg-rule" />
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="max-w-md mx-auto p-6 border border-ink bg-sheet text-center">
        <h2 className="font-serif text-xl font-bold text-ink">कार्य आदेश नहीं मिला</h2>
        <p className="font-sans text-xs text-ink-2 mt-1">{error}</p>
      </div>
    );
  }

  const isDone = workOrder.status === 'done';
  const isInProgress = workOrder.status === 'in_progress';

  return (
    <div className="max-w-md mx-auto min-h-screen bg-paper pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-ink py-3 px-2">
        <span className="font-serif font-extrabold text-lg text-ink">
          Wajah · {lang === 'hi' ? 'कार्य आदेश' : 'Work Order'}
        </span>
        <div className="flex items-center gap-1 font-mono text-xs">
          <button
            onClick={() => setLang('en')}
            className={`px-1 ${lang === 'en' ? 'font-bold underline text-ink' : 'text-ink-3'}`}
          >
            EN
          </button>
          <span>|</span>
          <button
            onClick={() => setLang('hi')}
            className={`px-1 ${lang === 'hi' ? 'font-bold underline text-ink' : 'text-ink-3'}`}
          >
            हिं
          </button>
        </div>
      </div>

      {/* Done Confirmation Banner */}
      {isDone && (
        <div className="p-4 bg-ink text-white font-serif text-lg font-bold leading-snug">
          {lang === 'hi'
            ? 'धन्यवाद। लगभग 3 घंटे में सेंसर से परिणाम मापा जाएगा।'
            : 'Thank you. Sensors will measure the result in about 3 hours.'}
        </div>
      )}

      <div className="p-4 space-y-6">
        {/* Title & Area */}
        <div>
          <div className="font-mono text-sm font-bold tracking-wider text-ink-3">
            {workOrder.id.toUpperCase()}
          </div>
          <h1 className="font-devanagari font-extrabold text-3xl sm:text-4xl text-ink mt-1">
            {areaLabel(workOrder.area, lang)}
          </h1>
        </div>

        {/* Timeline Stamps */}
        <div className="py-3 border-b border-rule">
          <StepTimeline
            steps={[
              { label: lang === 'hi' ? 'जारी' : 'Issued', time: formatTimeIST(workOrder.issuedAt) || '--', reached: true },
              { label: lang === 'hi' ? 'काम शुरू' : 'Started', time: formatTimeIST(workOrder.startedAt) || '--', reached: isInProgress || isDone },
              { label: lang === 'hi' ? 'काम पूरा' : 'Done', time: formatTimeIST(workOrder.doneAt) || '--', reached: isDone },
            ]}
          />
        </div>

        {/* Section: What to do */}
        <div className="space-y-1.5 border-b border-rule pb-4">
          <div className="text-xs font-mono uppercase font-bold text-ink-3">
            {lang === 'hi' ? 'क्या करना है' : 'What to do'}
          </div>
          <h2 className="font-serif text-2xl font-extrabold text-ink flex items-center gap-2">
            <span>💧</span>
            <span>{actionLabel(workOrder.actionType, lang)}</span>
          </h2>
          <p className="font-sans text-sm sm:text-base text-ink leading-relaxed mt-2">
            {instructionsText(workOrder, lang)}
          </p>
        </div>

        {/* Section: Why */}
        <div className="space-y-1.5 border-b border-rule pb-4">
          <div className="text-xs font-mono uppercase font-bold text-ink-3">
            {lang === 'hi' ? 'क्यों' : 'Why'}
          </div>
          <p className="font-sans text-sm text-ink-2 leading-relaxed">
            {reasonText(workOrder.reason, lang)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-2">
          <FieldActionButtons
            workOrder={workOrder}
            onUpdate={(updated) => setWorkOrder(updated)}
          />
        </div>

        {/* Footer info */}
        {isDone && (
          <div className="text-xs font-sans text-ink-3 text-center pt-2">
            {lang === 'hi'
              ? 'यह आदेश पूरा हो चुका है। अब इसमें बदलाव नहीं हो सकता।'
              : 'This work order is complete and cannot be edited.'}
          </div>
        )}
      </div>
    </div>
  );
}
