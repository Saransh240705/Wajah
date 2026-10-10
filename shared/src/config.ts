// Every threshold used by the engine, effect measurement, board and workflow.
// Starting heuristics for the hackathon, not validated constants (master PRD section 4).
// Engine and effect code must read from here; no threshold literals elsewhere.

import type { Cause, Confidence, HourBand } from './types';

type NumericFeature = 'pmRatio' | 'coRise' | 'no2Rise' | 'spatialShare' | 'windSpeed' | 'windDir' | 'blh' | 'upwindFires';

export type ScoreRule =
  | { key: string; feature: NumericFeature; op: 'gte' | 'lte' | 'lt' | 'gt'; value: number; points: number }
  | { key: string; feature: NumericFeature; op: 'between'; min: number; max: number; points: number }
  | { key: string; feature: 'hourBand'; op: 'in'; bands: HourBand[]; points: number }
  | { key: string; features: NumericFeature[]; op: 'allGte'; value: number; points: number };

export const config = {
  timezone: 'Asia/Kolkata',

  // 4.1 Spike detection
  detect: {
    minSpikePm25: 90,          // start of India's "Poor" band
    baselineFactor: 1.5,       // spike >= max(factor x baseline, baseline + add)
    baselineAdd: 60,
    baselineDays: 7,
    minBaselineDays: 3,        // below this, fall back to the previous 24 hours
    fallbackBaselineHours: 24,
    minSpikeHours: 2,          // consecutive spike hours to open an incident
    mergeGapHours: 1,          // windows separated by this many hours or less merge
    closeAfterHours: 2,        // non-spike hours that close an incident
    ingestLookbackHours: 72,   // detection window after each ingest
  },

  // 4.2 Features
  features: {
    medianDays: 7,
    fireLookbackHours: 48,
    fireMinKm: 50,
    fireMaxKm: 450,
    fireSectorHalfDeg: 35,
    // Local (Asia/Kolkata) hour ranges, start inclusive, end exclusive. Night wraps midnight.
    hourBands: {
      night: { from: 21, to: 3 },
      morning_rush: { from: 7, to: 11 },
      evening_rush: { from: 17, to: 21 },
    },
  },

  // 4.3 Cause scoring
  score: {
    maxPoints: 100,
    rules: {
      local_burning: [
        { key: 'pm_ratio_fine', feature: 'pmRatio', op: 'gte', value: 0.6, points: 25 },
        { key: 'co_rise', feature: 'coRise', op: 'gte', value: 1.3, points: 25 },
        { key: 'few_areas', feature: 'spatialShare', op: 'lte', value: 0.3, points: 25 },
        { key: 'night', feature: 'hourBand', op: 'in', bands: ['night'], points: 15 },
        { key: 'few_upwind_fires', feature: 'upwindFires', op: 'lt', value: 10, points: 10 },
      ],
      dust: [
        { key: 'pm_ratio_coarse', feature: 'pmRatio', op: 'lte', value: 0.4, points: 40 },
        { key: 'co_flat', feature: 'coRise', op: 'lt', value: 1.15, points: 15 },
        { key: 'wind_strong', feature: 'windSpeed', op: 'gte', value: 4, points: 15 },
        { key: 'some_areas', feature: 'spatialShare', op: 'lte', value: 0.5, points: 15 },
        { key: 'daytime', feature: 'hourBand', op: 'in', bands: ['day'], points: 15 },
      ],
      traffic: [
        { key: 'no2_rise', feature: 'no2Rise', op: 'gte', value: 1.3, points: 35 },
        { key: 'rush_hour', feature: 'hourBand', op: 'in', bands: ['morning_rush', 'evening_rush'], points: 25 },
        { key: 'co_rise_traffic', feature: 'coRise', op: 'gte', value: 1.2, points: 15 },
        { key: 'some_areas', feature: 'spatialShare', op: 'lte', value: 0.5, points: 15 },
        { key: 'pm_ratio_mixed', feature: 'pmRatio', op: 'between', min: 0.4, max: 0.7, points: 10 },
      ],
      regional_smoke: [
        { key: 'upwind_fires', feature: 'upwindFires', op: 'gte', value: 50, points: 35 },
        { key: 'upwind_fires_many', feature: 'upwindFires', op: 'gte', value: 150, points: 10 },
        { key: 'most_areas', feature: 'spatialShare', op: 'gte', value: 0.6, points: 30 },
        { key: 'wind_from_northwest', feature: 'windDir', op: 'between', min: 250, max: 360, points: 15 },
        { key: 'pm_ratio_smoke', feature: 'pmRatio', op: 'gte', value: 0.55, points: 10 },
      ],
      trapped_air: [
        { key: 'wind_calm', feature: 'windSpeed', op: 'lte', value: 1.5, points: 30 },
        { key: 'low_mixing', feature: 'blh', op: 'lte', value: 300, points: 20 },
        { key: 'most_areas', feature: 'spatialShare', op: 'gte', value: 0.6, points: 30 },
        { key: 'few_fires', feature: 'upwindFires', op: 'lt', value: 50, points: 10 },
        { key: 'co_no2_rise', features: ['coRise', 'no2Rise'], op: 'allGte', value: 1.2, points: 10 },
      ],
    } satisfies Record<Cause, ScoreRule[]>,
  },

  // 4.4 Confidence
  confidence: {
    highMin: 70,
    highLead: 20,
    mediumMin: 50,
  },

  // 4.6 Work orders
  workOrders: {
    // Recommend the alternative once the first action was tried this many times here and never worked
    alternativeAfterTries: 2,
    polishTimeoutMs: 10_000,
  },

  // 4.7 Effect measurement. Local causes: pool of past unacted local spikes. City-wide causes: other stations, same hours.
  effect: {
    beforeHours: 2,              // readings ending at or before T
    afterHours: 3,               // readings starting the hour after doneAt
    minReadingsPerWindow: 2,
    workedNetPct: -15,           // net change at or below this is 'worked'
    cityShiftLimitPct: 25,       // |cityChangePct| at or above this is 'inconclusive'
    rainLimitMm: 0.2,            // rain above this in either window is 'inconclusive'
    windShiftFactor: 2,          // mean wind doubled or halved is 'inconclusive'
    minStationPool: 3,           // this station's unacted incidents needed for its own baseline
    minHotspotPool: 5,           // otherwise all hotspot stations' unacted incidents
    minComparisonStations: 3,    // city-wide causes: fewer other stations with full data is 'inconclusive'
    decimals: 1,
  },

  // Replay has no real clock during an incident: work order times are simulated relative to the incident,
  // so the readings that follow exist. Minutes. Issue after 2 spike hours, when detection first sees the incident.
  replayClock: {
    issueAfterStartMin: 120,
    startAfterIssueMin: 20,
    doneAfterStartMin: 45,
  },

  // Section 6.3 placebo test: a fake work order starting 1 hour after the spike began and lasting 1 hour
  placebo: {
    startAfterSpikeMin: 60,
    durationMin: 60,
  },

  // 4.8 Recurrence check
  recurrence: {
    windowPadHours: 1,
    cleanNightsToClear: 2,
  },

  // 6.1 Action board (used by the board module)
  board: {
    activeHours: 24,
    confidenceWeight: { high: 1.0, medium: 0.8, low: 0.5 } satisfies Record<Confidence, number>,
    recurrenceBoost: 0.25,
  },

  // Section 7 workflow execution input, in seconds
  workflow: {
    live: { pollSeconds: 300, slaSeconds: 7200, readingsSeconds: 12600 },
    demo: { pollSeconds: 5, slaSeconds: 7200, readingsSeconds: 5 },
  },

  // Section 5 agent limits
  agent: {
    maxToolCalls: 6,
    timeoutMs: 45_000,
    historyTurns: 6,
  },

  // Photo check (P1)
  photo: {
    uploadUrlTtlSeconds: 300,
    checkTimeoutMs: 15_000,
  },

  // External API calls
  external: {
    timeoutMs: 10_000,
  },
} as const;

export type Config = typeof config;
