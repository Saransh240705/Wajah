'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { Incident, Reading } from '@wajah/shared';
import { formatTimeIST } from '../lib/utils';

interface ReadingChartProps {
  readings: Reading[];
  incidents?: Incident[];
  pollutant?: 'pm25' | 'pm10' | 'no2' | 'co';
  height?: number;
  showToggles?: boolean;
  onSelectIncident?: (id: string) => void;
  className?: string;
}

export function ReadingChart({
  readings,
  incidents = [],
  pollutant: initialPollutant = 'pm25',
  height = 240,
  showToggles = true,
  onSelectIncident,
  className = '',
}: ReadingChartProps) {
  const [activePollutant, setActivePollutant] = useState<'pm25' | 'pm10' | 'no2' | 'co'>(initialPollutant);

  if (!readings || readings.length === 0) {
    return (
      <div className={`p-8 border border-ink bg-paper text-center ${className}`}>
        <div className="font-serif text-lg font-bold text-ink">No readings for these 48 hours.</div>
        <p className="font-sans text-xs text-ink-2 mt-1">
          The monitor may be offline. Switch to Replay to see recorded data.
        </p>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = readings.map((r) => ({
    ts: r.ts,
    time: formatTimeIST(r.ts),
    val: r[activePollutant] ?? null,
  }));

  const pollutantLabels = {
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO2',
    co: 'CO',
  };

  return (
    <div className={`border border-ink bg-sheet p-4 ${className}`}>
      {/* Top Toggles */}
      {showToggles && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3 mb-4">
          <div className="flex items-center gap-1 font-mono text-xs">
            {(['pm25', 'pm10', 'no2', 'co'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setActivePollutant(p)}
                className={`px-2.5 py-1 border transition-colors ${
                  activePollutant === p
                    ? 'border-ink bg-ink text-white font-bold'
                    : 'border-rule bg-paper text-ink hover:border-ink'
                }`}
              >
                {pollutantLabels[p]}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-ink-3">
            {activePollutant === 'pm10' ? 'PM10: coarse dust' : activePollutant === 'no2' ? 'NO2: traffic emissions' : activePollutant === 'co' ? 'CO: burning' : 'PM2.5: fine smoke & dust'}
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {/* Reference Areas for Spikes */}
            {incidents.map((inc, i) => {
              const startIdx = chartData.findIndex((d) => d.ts >= inc.start);
              const endIdx = inc.end
                ? chartData.findIndex((d) => d.ts >= (inc.end as string))
                : chartData.length - 1;
              if (startIdx >= 0 && endIdx >= 0) {
                return (
                  <ReferenceArea
                    key={i}
                    x1={chartData[startIdx]?.time}
                    x2={chartData[endIdx]?.time}
                    fill="#141414"
                    fillOpacity={0.08}
                    onClick={() => onSelectIncident?.(inc.id)}
                    className="cursor-pointer"
                  />
                );
              }
              return null;
            })}

            {/* Threshold Lines for PM2.5 */}
            {activePollutant === 'pm25' && (
              <>
                <ReferenceLine y={90} stroke="#6B6A64" strokeDasharray="3 3" label={{ value: 'Poor (90)', position: 'insideRight', fill: '#6B6A64', fontSize: 10 }} />
                <ReferenceLine y={120} stroke="#6B6A64" strokeDasharray="3 3" label={{ value: 'Very poor (120)', position: 'insideRight', fill: '#6B6A64', fontSize: 10 }} />
                <ReferenceLine y={250} stroke="#141414" strokeDasharray="3 3" label={{ value: 'Severe (250)', position: 'insideRight', fill: '#141414', fontSize: 10 }} />
              </>
            )}

            <XAxis
              dataKey="time"
              tick={{ fill: '#6B6A64', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              interval="preserveStartEnd"
              axisLine={{ stroke: '#C9C7BF' }}
              tickLine={{ stroke: '#C9C7BF' }}
            />
            <YAxis
              tick={{ fill: '#6B6A64', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              axisLine={{ stroke: '#C9C7BF' }}
              tickLine={{ stroke: '#C9C7BF' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#141414',
                color: '#F2F1ED',
                border: 'none',
                fontFamily: 'IBM Plex Mono',
                fontSize: 12,
              }}
              formatter={(val: number) => [`${Math.round(val)} µg/m³`, pollutantLabels[activePollutant]]}
            />
            <Line
              type="monotone"
              dataKey="val"
              stroke="#141414"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#141414' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[10px] font-mono text-ink-3 flex items-center justify-between">
        <span>Shaded grey bands indicate detected spike windows.</span>
        <span>µg/m³</span>
      </div>
    </div>
  );
}
