import type { AqiBand } from './types';

// India's AQI breakpoints. Official bands apply to 24-hour averages;
// Wajah applies them to hourly values for colour only (master PRD section 9).
const PM25_UPPER: [number, AqiBand][] = [
  [30, 'good'], [60, 'satisfactory'], [90, 'moderate'], [120, 'poor'], [250, 'very_poor'],
];
const PM10_UPPER: [number, AqiBand][] = [
  [50, 'good'], [100, 'satisfactory'], [250, 'moderate'], [350, 'poor'], [430, 'very_poor'],
];

function toBand(value: number | null | undefined, table: [number, AqiBand][]): AqiBand | null {
  if (value == null || Number.isNaN(value)) return null;
  for (const [upper, band] of table) if (value <= upper) return band;
  return 'severe';
}

export const pm25Band = (value: number | null | undefined) => toBand(value, PM25_UPPER);
export const pm10Band = (value: number | null | undefined) => toBand(value, PM10_UPPER);

export const BAND_LABEL: Record<AqiBand, { en: string; hi: string }> = {
  good: { en: 'Good', hi: 'अच्छा' },
  satisfactory: { en: 'Satisfactory', hi: 'संतोषजनक' },
  moderate: { en: 'Moderate', hi: 'मध्यम' },
  poor: { en: 'Poor', hi: 'ख़राब' },
  very_poor: { en: 'Very poor', hi: 'बहुत ख़राब' },
  severe: { en: 'Severe', hi: 'गंभीर' },
};
