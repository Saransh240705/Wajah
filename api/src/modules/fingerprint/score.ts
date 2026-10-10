import { config, type Cause, type Confidence, type EvidenceChip, type Features, type ScoreRule } from '@wajah/shared';

type Cfg = Pick<typeof config, 'score' | 'confidence'>;

export const CAUSES: Cause[] = ['local_burning', 'dust', 'traffic', 'regional_smoke', 'trapped_air'];

/** Optional counts so chips can say "Only 2 of 14 areas spiked" instead of a share. */
export interface ScoreContext { spikedStations?: number; stationsWithData?: number }

export interface ScoreResult {
  scores: Record<Cause, number>;
  topCause: Cause;
  runnerUp: Cause;
  confidence: Confidence;
  evidence: EvidenceChip[];
}

function fires(rule: ScoreRule, f: Features): boolean {
  switch (rule.op) {
    case 'in':
      return (rule.bands as readonly string[]).includes(f.hourBand);
    case 'allGte':
      return rule.features.every((k) => f[k] != null && (f[k] as number) >= rule.value);
    case 'between': {
      const v = f[rule.feature];
      return v != null && v >= rule.min && v <= rule.max;
    }
    default: {
      const v = f[rule.feature];
      if (v == null) return false; // missing input never fires (track A section 4)
      if (rule.op === 'gte') return v >= rule.value;
      if (rule.op === 'gt') return v > rule.value;
      if (rule.op === 'lte') return v <= rule.value;
      return v < rule.value;
    }
  }
}

const fx = (n: number) => `${n.toFixed(1)}×`;
const BAND_TEXT = { night: 'at night', morning_rush: 'in the morning rush hour', evening_rush: 'in the evening rush hour', day: 'in the daytime' } as const;

function areas(f: Features, ctx: ScoreContext): string {
  if (ctx.spikedStations != null && ctx.stationsWithData) return `${ctx.spikedStations} of ${ctx.stationsWithData} areas`;
  return `${Math.round(f.spatialShare * 100)}% of areas`;
}

function chipFor(rule: ScoreRule, cause: Cause, f: Features, ctx: ScoreContext): EvidenceChip {
  const c = (label: string, value: string): EvidenceChip => ({ key: rule.key, cause, label, value, effect: 'supports' });
  switch (rule.key) {
    case 'pm_ratio_fine':
    case 'pm_ratio_smoke':
      return c(`Fine particles dominate: PM2.5 is ${f.pmRatio!.toFixed(2)} of PM10`, f.pmRatio!.toFixed(2));
    case 'pm_ratio_coarse':
      return c(`Coarse particles dominate: PM2.5 is only ${f.pmRatio!.toFixed(2)} of PM10`, f.pmRatio!.toFixed(2));
    case 'pm_ratio_mixed':
      return c(`Mixed particle sizes: PM2.5 is ${f.pmRatio!.toFixed(2)} of PM10`, f.pmRatio!.toFixed(2));
    case 'co_rise':
    case 'co_rise_traffic':
      return c(`CO up ${fx(f.coRise!)} its usual level`, fx(f.coRise!));
    case 'co_flat':
      return c(`CO close to its usual level (${fx(f.coRise!)})`, fx(f.coRise!));
    case 'no2_rise':
      return c(`NO2 up ${fx(f.no2Rise!)} its usual level`, fx(f.no2Rise!));
    case 'co_no2_rise':
      return c(`CO and NO2 both up: ${fx(f.coRise!)} and ${fx(f.no2Rise!)}`, `${fx(f.coRise!)}, ${fx(f.no2Rise!)}`);
    case 'few_areas':
    case 'some_areas':
      return c(`Only ${areas(f, ctx)} spiked`, areas(f, ctx).replace(' areas', ''));
    case 'most_areas':
      return c(`${areas(f, ctx)} spiked together`, areas(f, ctx).replace(' areas', ''));
    case 'wind_strong':
      return c(`Wind ${f.windSpeed!.toFixed(1)} m/s, strong enough to lift dust`, `${f.windSpeed!.toFixed(1)} m/s`);
    case 'wind_calm':
      return c(`Wind nearly calm at ${f.windSpeed!.toFixed(1)} m/s`, `${f.windSpeed!.toFixed(1)} m/s`);
    case 'low_mixing':
      return c(`Air trapped near the ground: mixing layer only ${Math.round(f.blh!)} m deep`, `${Math.round(f.blh!)} m`);
    case 'wind_from_northwest':
      return c(`Wind from the north-west (${Math.round(f.windDir!)}°), the direction of the farm fires`, `${Math.round(f.windDir!)}°`);
    case 'upwind_fires':
    case 'upwind_fires_many':
      return c(`${f.upwindFires} farm fires upwind in the last 48 hours`, String(f.upwindFires));
    case 'few_upwind_fires':
    case 'few_fires':
      return c(`Only ${f.upwindFires} farm fires upwind`, String(f.upwindFires));
    case 'night':
    case 'rush_hour':
    case 'daytime':
      return c(`Peak ${BAND_TEXT[f.hourBand]}`, f.hourBand.replace('_', ' '));
    default:
      return c(rule.key, '');
  }
}

/** Score the five causes from features (master PRD 4.3 and 4.4). Pure. */
export function scoreCauses(features: Features, cfg: Cfg = config, ctx: ScoreContext = {}): ScoreResult {
  const scores = {} as Record<Cause, number>;
  const evidence: EvidenceChip[] = [];
  for (const cause of CAUSES) {
    let pts = 0;
    for (const rule of cfg.score.rules[cause] as readonly ScoreRule[]) {
      if (!fires(rule, features)) continue;
      pts += rule.points;
      evidence.push(chipFor(rule, cause, features, ctx));
    }
    scores[cause] = Math.min(pts, cfg.score.maxPoints);
  }
  const ranked = [...CAUSES].sort((a, b) => scores[b] - scores[a]);
  const [topCause, runnerUp] = ranked as [Cause, Cause];
  const top = scores[topCause];
  const lead = top - scores[runnerUp];
  const { highMin, highLead, mediumMin } = cfg.confidence;
  const confidence: Confidence = top >= highMin && lead >= highLead ? 'high' : top >= mediumMin ? 'medium' : 'low';
  // Top cause's chips first, then runner-up, then the rest
  const order = (c: Cause) => (c === topCause ? 0 : c === runnerUp ? 1 : 2);
  evidence.sort((a, b) => order(a.cause) - order(b.cause));
  return { scores, topCause, runnerUp, confidence, evidence };
}
