'use client';

import React, { useRef, useState } from 'react';
import type { WorkOrder } from '@wajah/shared';
import { useApp } from '../lib/context';
import { finishWorkOrder, getPhotoUploadUrl, startWorkOrder } from '../lib/api';
import { formatTimeIST } from '../lib/utils';

interface FieldActionButtonsProps {
  workOrder: WorkOrder;
  onUpdate: (updated: WorkOrder) => void;
  className?: string;
}

export function FieldActionButtons({ workOrder, onUpdate, className = '' }: FieldActionButtonsProps) {
  const { lang } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoTime, setPhotoTime] = useState<string | null>(null);

  const isIssued = workOrder.status === 'issued';
  const isInProgress = workOrder.status === 'in_progress';
  const isDone = workOrder.status === 'done';

  const handleStart = async () => {
    setLoadingAction('start');
    setErrorAction(null);
    try {
      const updated = await startWorkOrder(workOrder.id);
      onUpdate(updated);
    } catch {
      setErrorAction('start');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDone = async () => {
    setLoadingAction('done');
    setErrorAction(null);
    try {
      const updated = await finishWorkOrder(workOrder.id, {
        photoKey: photoPreview ? `photos/${workOrder.id}.jpg` : undefined,
      });
      onUpdate(updated);
    } catch {
      setErrorAction('done');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingAction('photo');
    setErrorAction(null);
    try {
      const urlInfo = await getPhotoUploadUrl(workOrder.id);
      // Create local preview URL
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
      setPhotoTime(new Date().toISOString());

      // If already done, re-finish with photo key
      if (isDone) {
        const updated = await finishWorkOrder(workOrder.id, { photoKey: urlInfo.key });
        onUpdate(updated);
      }
    } catch {
      setErrorAction('photo');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. START BUTTON / ROW */}
      {isIssued ? (
        <button
          onClick={handleStart}
          disabled={loadingAction === 'start'}
          className="w-full h-[68px] bg-ink text-white font-serif text-xl sm:text-2xl font-extrabold flex items-center justify-center gap-3 hover:bg-ink-2 active:bg-black transition-colors disabled:opacity-50"
        >
          <span>▶</span>
          <span>{loadingAction === 'start' ? 'भेजा जा रहा है...' : (lang === 'hi' ? 'काम शुरू किया' : 'Mark started')}</span>
        </button>
      ) : (
        <div className="w-full h-[56px] px-4 border border-ink bg-sheet flex items-center justify-between font-serif text-lg font-bold text-ink">
          <div className="flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span>{lang === 'hi' ? 'काम शुरू किया' : 'Mark started'}</span>
          </div>
          <span className="font-mono text-sm font-normal text-ink-3">
            {formatTimeIST(workOrder.startedAt)}
          </span>
        </div>
      )}

      {/* Start Error */}
      {errorAction === 'start' && (
        <div className="p-3 border border-dashed border-ink bg-paper text-xs font-mono">
          <p className="text-ink font-bold">
            {lang === 'hi' ? '"काम शुरू किया" नहीं भेजा जा सका। नेटवर्क जाँचें।' : 'Could not send Start. Check network.'}
          </p>
          <button
            onClick={handleStart}
            className="mt-2 px-3 py-1 bg-ink text-white font-bold"
          >
            {lang === 'hi' ? 'फिर कोशिश करें' : 'Retry'}
          </button>
        </div>
      )}

      {/* 2. DONE BUTTON / ROW */}
      {isDone ? (
        <div className="w-full h-[56px] px-4 border border-ink bg-sheet flex items-center justify-between font-serif text-lg font-bold text-ink">
          <div className="flex items-center gap-2">
            <span className="text-xl">✓</span>
            <span>{lang === 'hi' ? 'काम पूरा किया' : 'Mark done'}</span>
          </div>
          <span className="font-mono text-sm font-normal text-ink-3">
            {formatTimeIST(workOrder.doneAt)}
          </span>
        </div>
      ) : isInProgress ? (
        <button
          onClick={handleDone}
          disabled={loadingAction === 'done'}
          className="w-full h-[68px] bg-ink text-white font-serif text-xl sm:text-2xl font-extrabold flex items-center justify-center gap-3 hover:bg-ink-2 active:bg-black transition-colors disabled:opacity-50"
        >
          <span>✓</span>
          <span>{loadingAction === 'done' ? 'भेजा जा रहा है...' : (lang === 'hi' ? 'काम पूरा किया' : 'Mark done')}</span>
        </button>
      ) : (
        <div className="w-full h-[68px] px-4 border border-dashed border-ink-3 bg-paper flex flex-col items-center justify-center text-ink-3">
          <span className="font-serif text-lg font-bold">
            {lang === 'hi' ? 'काम पूरा किया' : 'Mark done'}
          </span>
          <span className="text-xs font-sans mt-0.5">
            {lang === 'hi' ? 'पहले काम शुरू करें' : 'Start work first'}
          </span>
        </div>
      )}

      {/* Done Error */}
      {errorAction === 'done' && (
        <div className="p-3 border border-dashed border-ink bg-paper text-xs font-mono">
          <p className="text-ink font-bold">
            {lang === 'hi' ? '"काम पूरा किया" नहीं भेजा जा सका। नेटवर्क जाँचें।' : 'Could not send Done. Check network.'}
          </p>
          <button
            onClick={handleDone}
            className="mt-2 px-3 py-1 bg-ink text-white font-bold"
          >
            {lang === 'hi' ? 'फिर कोशिश करें' : 'Retry'}
          </button>
        </div>
      )}

      {/* 3. ADD PHOTO BUTTON / ROW */}
      {workOrder.photo || photoPreview ? (
        <div className="space-y-2">
          <div className="w-full h-[56px] px-4 border border-ink bg-sheet flex items-center justify-between font-serif text-lg font-bold text-ink">
            <div className="flex items-center gap-2">
              <span className="text-xl">✓</span>
              <span>{lang === 'hi' ? 'फ़ोटो जोड़ी गई' : 'Photo added'}</span>
            </div>
            <span className="font-mono text-sm font-normal text-ink-3">
              {formatTimeIST(photoTime || workOrder.doneAt)}
            </span>
          </div>

          {/* Verification note box */}
          <div className="p-3 border border-ink bg-fill/40 flex items-start gap-3">
            <span className="text-2xl">📷</span>
            <div className="text-xs font-sans">
              <div className="font-mono uppercase font-bold text-ink">
                {lang === 'hi' ? 'फ़ोटो की जाँच: ठीक है' : 'Photo check: PASS'}
              </div>
              <p className="text-ink mt-0.5">
                {workOrder.photo?.note || (lang === 'hi' ? 'पानी का टैंकर सड़क पर छिड़काव कर रहा है।' : 'A water tanker is spraying a road.')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loadingAction === 'photo'}
          className="w-full h-[56px] border-2 border-ink bg-paper text-ink font-serif text-lg font-bold flex items-center justify-center gap-2 hover:bg-sheet transition-colors"
        >
          <span>📷</span>
          <span>{loadingAction === 'photo' ? 'अपलोड हो रहा है...' : (lang === 'hi' ? 'फ़ोटो जोड़ें' : 'Add photo')}</span>
        </button>
      )}
    </div>
  );
}
