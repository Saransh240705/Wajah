import type { AqiBand } from '@wajah/shared';

/** Format an ISO date string to India Standard Time (IST, UTC+5:30) */
export function formatTimeIST(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

export function formatDateTimeRangeIST(startIso: string, endIso?: string | null): string {
  const dateStr = formatDateIST(startIso);
  const startTime = formatTimeIST(startIso);
  if (!endIso) {
    return `${dateStr}, since ${startTime}`;
  }
  const endTime = formatTimeIST(endIso);
  return `${dateStr}, ${startTime} to ${endTime}`;
}

export function formatPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return 'Not judged';
  const rounded = Math.round(val);
  if (rounded < 0) return `−${Math.abs(rounded)}%`;
  if (rounded > 0) return `+${rounded}%`;
  return '0%';
}

export function bandBgClass(band: AqiBand | string | null | undefined): string {
  switch (band) {
    case 'good':
      return 'bg-band-good text-white';
    case 'satisfactory':
      return 'bg-band-satisfactory text-ink';
    case 'moderate':
      return 'bg-band-moderate text-ink';
    case 'poor':
      return 'bg-band-poor text-ink';
    case 'very_poor':
      return 'bg-band-very-poor text-white';
    case 'severe':
      return 'bg-band-severe text-white';
    default:
      return 'bg-fill text-ink';
  }
}

export function bandBorderClass(band: AqiBand | string | null | undefined): string {
  switch (band) {
    case 'good':
      return 'border-band-good';
    case 'satisfactory':
      return 'border-band-satisfactory';
    case 'moderate':
      return 'border-band-moderate';
    case 'poor':
      return 'border-band-poor';
    case 'very_poor':
      return 'border-band-very-poor';
    case 'severe':
      return 'border-band-severe';
    default:
      return 'border-rule';
  }
}

export function bandHex(band: AqiBand | string | null | undefined): string {
  switch (band) {
    case 'good':
      return '#1E7B3A';
    case 'satisfactory':
      return '#9BD15A';
    case 'moderate':
      return '#F5D31F';
    case 'poor':
      return '#F28C1B';
    case 'very_poor':
      return '#D92D20';
    case 'severe':
      return '#7A1220';
    default:
      return '#6B6A64';
  }
}
