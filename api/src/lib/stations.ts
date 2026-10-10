import type { Station } from '@wajah/shared';
import stationsJson from '@wajah/shared/stations.json' with { type: 'json' };

export const STATIONS = stationsJson as Station[];
export const stationById = (id: string) => STATIONS.find((s) => s.id === id);
export const HOTSPOT_IDS = STATIONS.filter((s) => s.isHotspot).map((s) => s.id);
