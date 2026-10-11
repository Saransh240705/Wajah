'use client';

import React from 'react';

export interface TimelineStep {
  label: string;
  time: string;
  reached: boolean;
}

/**
 * Evenly spaced steps (e.g. Issued, Started, Done). Each step's dot, label and time are centered in its column and
 * the connectors run exactly between dot centers: solid once the next step is reached, dashed before.
 */
export function StepTimeline({ steps }: { steps: TimelineStep[] }) {
  const n = steps.length;
  return (
    <div className="relative grid font-mono text-xs" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {steps.slice(1).map((s, i) => (
        <div
          key={`line-${i}`}
          aria-hidden
          className={`absolute top-[5px] border-t-2 ${s.reached ? 'border-ink' : 'border-dashed border-rule'}`}
          style={{ left: `${((i + 0.5) / n) * 100}%`, width: `${100 / n}%` }}
        />
      ))}
      {steps.map((s, i) => (
        <div key={i} className="relative flex flex-col items-center text-center px-1">
          <span className={`w-3 h-3 rounded-full border-2 ${s.reached ? 'bg-ink border-ink' : 'bg-paper border-rule'}`} />
          <span className={`mt-2 font-bold leading-tight ${s.reached ? 'text-ink' : 'text-ink-3'}`}>{s.label}</span>
          <span className="text-ink-3 mt-0.5">{s.time}</span>
        </div>
      ))}
    </div>
  );
}
