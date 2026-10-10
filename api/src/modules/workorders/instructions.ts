import { ACTIONS, config, fillTemplate, type ActionType, type Agency, type Incident } from '@wajah/shared';

const HOUR_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });

function localHM(iso: string): { h: number; m: number } {
  const [h, m] = HOUR_FMT.format(new Date(iso)).split(':').map(Number);
  return { h: h!, m: m! };
}

/** '1pm', '10:30pm' in India time. */
export function localTimeEn(iso: string): string {
  const { h, m } = localHM(iso);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** 'दोपहर 1 बजे', 'रात 10:30 बजे' in India time. */
export function localTimeHi(iso: string): string {
  const { h, m } = localHM(iso);
  const period = h >= 4 && h < 12 ? 'सुबह' : h >= 12 && h < 16 ? 'दोपहर' : h >= 16 && h < 19 ? 'शाम' : 'रात';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} बजे`;
}

const fmtRatio = (r: number) => r.toFixed(1).replace(/\.0$/, '');

export interface InstructionOptions {
  /** Usual PM10 at this station, when known; needed to state "N times the usual level" for dust. */
  usualPm10?: number | null;
}

/** Fill the playbook template for this incident and action (master PRD 4.6). Numbers come from the incident only. */
export function buildInstructions(incident: Incident, actionType: ActionType, agency: Agency, opts: InstructionOptions = {}) {
  const usePm10 = incident.topCause === 'dust' && incident.peakPm10 != null;
  const pollutant = usePm10 ? 'PM10' : 'PM2.5';
  const peak = Math.round(usePm10 ? incident.peakPm10! : incident.peakPm25);
  const usual = usePm10 ? opts.usualPm10 : incident.baselinePm25;
  const ratio = usual && usual > 0 ? peak / usual : null;
  const hasRatio = ratio != null && ratio > 1;
  const action = ACTIONS[actionType];
  const base = { area: incident.area, pollutant, peak, agency };
  return {
    en: fillTemplate(action.templateEn, {
      ...base, time: localTimeEn(incident.peakAt),
      usual: hasRatio ? `, about ${fmtRatio(ratio!)} times the usual level` : '',
    }),
    hi: fillTemplate(action.templateHi, {
      ...base, time: localTimeHi(incident.peakAt),
      usual: hasRatio ? `, जो सामान्य स्तर का लगभग ${fmtRatio(ratio!)} गुना है` : '',
    }),
  };
}
