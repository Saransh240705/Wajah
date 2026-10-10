// Contract between Track A and Track B. Source: master PRD section 9 (version 2).
// Change only after telling the other track.

export type Dataset = 'live' | 'replay';
export type Cause = 'local_burning' | 'dust' | 'traffic' | 'regional_smoke' | 'trapped_air';
export type Confidence = 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'dispatched' | 'cleared' | 'recurred';
export type AqiBand = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';
export type HourBand = 'night' | 'morning_rush' | 'evening_rush' | 'day';

// v2
export type ActionType =
  | 'water_sprinkling' | 'mechanical_sweeping' | 'anti_burning_patrol'
  | 'traffic_management' | 'construction_inspection' | 'public_advisory';
export type Agency = 'MCD' | 'PWD' | 'DPCC' | 'Traffic Police' | 'Residents';
export type WorkOrderStatus = 'issued' | 'in_progress' | 'done' | 'cancelled';
export type Verdict = 'worked' | 'no_effect' | 'inconclusive';

export interface Station {
  id: string;            // slug, e.g. 'anand-vihar'
  name: string;
  area: string;          // short label for the UI
  lat: number;
  lon: number;
  isHotspot: boolean;    // v2
  openaqLocationId?: number;
  cpcbName?: string;
}

export interface Reading {
  stationId: string;
  ts: string;            // ISO 8601, start of hour, UTC
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  co: number | null;
  so2: number | null;
  o3: number | null;
  source: 'openaq' | 'cpcb' | 'modelled';
}

export interface Weather {
  ts: string; windSpeed: number; windDir: number;
  blh: number | null;
  precip: number | null; // v2, mm in that hour
}
export interface Fire { lat: number; lon: number; acquiredAt: string; frp: number; confidence: string; }

export interface Features {
  pmRatio: number | null; coRise: number | null; no2Rise: number | null;
  spatialShare: number; windSpeed: number | null; windDir: number | null;
  blh: number | null; upwindFires: number; hourBand: HourBand;
}

export interface EvidenceChip {
  key: string; cause: Cause; label: string; value: string;
  effect: 'supports' | 'weakens';
}

// v2
export interface EffectResult {
  pollutant: 'pm25' | 'pm10';
  beforeMean: number;
  afterMean: number;
  changePct: number;          // at the hotspot
  expectedChangePct: number;  // usual fade when nobody acts
  cityChangePct: number;      // other stations, same hours
  netChangePct: number;       // changePct - expectedChangePct
  verdict: Verdict;
  note?: string;              // e.g. 'rain during the window', 'no baseline yet'
  measuredAt: string;
}

// v2
export interface PhotoCheck { key: string; result: 'pass' | 'fail' | 'unclear'; note: string; }

// v2, replaces DispatchAction
export interface WorkOrder {
  id: string;                 // `${incidentId}-w${n}`
  incidentId: string;
  stationId: string;
  area: string;
  actionType: ActionType;
  agency: Agency;
  status: WorkOrderStatus;
  reason: string;             // 'Dust is the likely cause. Sprinkling here worked 3 of 4 times.'
  instructionsEn: string;
  instructionsHi: string;
  escalationLevel: number;
  issuedAt: string;
  startedAt?: string;
  doneAt?: string;
  photo?: PhotoCheck;
  effect?: EffectResult;
  executionArn?: string;      // Step Functions execution, when deployed
  overdueNotified?: boolean;  // set once the overdue escalation has been sent
  demo?: boolean;             // true for simulated work orders
}

export interface VerifyCheck {
  date: string; result: 'clean' | 'recurred'; peakPm25: number | null; note?: string;
}

export interface Incident {
  id: string;                 // `${dataset}-${stationId}-${YYYYMMDDHH of start, UTC}`
  dataset: Dataset;
  stationId: string;
  area: string;
  start: string;
  end: string | null;
  peakPm25: number;
  peakPm10: number | null;    // v2
  peakAt: string;
  baselinePm25: number;
  features: Features;
  scores: Record<Cause, number>;
  topCause: Cause;
  confidence: Confidence;
  evidence: EvidenceChip[];
  status: IncidentStatus;
  recurrenceCount: number;
  escalationLevel: number;
  workOrders: WorkOrder[];    // v2, replaces actions
  checks: VerifyCheck[];
  evidenceKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StationSummary extends Station {
  latest: Reading | null;
  band: AqiBand | null;
  openIncidentId: string | null;
}

// v2
export interface BoardItem {
  incident: Incident;
  priority: number;
  localActionPossible: boolean;
  recommended: { actionType: ActionType; agency: Agency; reason: string };
  history: { tried: number; worked: number; avgNetChangePct: number | null };
}
export interface Board {
  summary: { actionable: number; noLocalAction: number; inProgress: number };
  items: BoardItem[];
}

// v2
export interface LedgerRow {
  stationId: string; area: string; actionType: ActionType;
  tried: number; worked: number; noEffect: number; inconclusive: number;
  avgNetChangePct: number | null;
  illustrative: boolean;      // true when built only from demo work orders
}
export interface Ledger {
  totals: { issued: number; measured: number; worked: number; noEffect: number; inconclusive: number };
  placebo: { tested: number; wronglyWorked: number } | null;
  rows: LedgerRow[];
}

export interface Scoreboard {
  totals: { incidents: number; dispatched: number; cleared: number; recurred: number };
  areas: {
    stationId: string; area: string;
    incidents: number; recurred: number; cleared: number;
    topCause: Cause | null; lastIncidentAt: string | null;
  }[];
}

// Ask Wajah agent, master PRD section 5
export interface AskRequest {
  mode?: 'ask' | 'brief';          // default 'ask'
  message?: string;                // required in ask mode
  history?: { role: 'user' | 'assistant'; text: string }[]; // last 6 turns at most
  stationId?: string;
  dataset?: Dataset;
  lang?: 'en' | 'hi';              // used in brief mode
}

export interface AskResponse {
  answer: string;
  evidence: EvidenceChip[];        // empty if no diagnosis ran
  incidentId?: string;
  suggestedActions: { type: 'open_incident' | 'issue_work_order' | 'open_board'; label: string; payload?: Record<string, string> }[];
}

// Error body for every non-2xx response, master PRD section 10
export interface ApiError { error: { code: string; message: string } }
