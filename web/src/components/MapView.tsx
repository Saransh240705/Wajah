'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Fire, Incident, StationSummary } from '@wajah/shared';
import { bandHex } from '../lib/utils';

interface MapViewProps {
  stations: StationSummary[];
  incidents?: Incident[];
  fires?: Fire[];
  selectedStationId?: string | null;
  onSelectStation?: (station: StationSummary) => void;
  showFires?: boolean;
  className?: string;
  zoom?: number;
  center?: [number, number];
}

// Dynamically import Leaflet components (SSR disabled)
const LeafletMap = dynamic(
  async () => {
    const L = await import('leaflet');
    const { MapContainer, TileLayer, Marker, Popup, CircleMarker } = await import('react-leaflet');

    // Return the actual React Leaflet component
    return function MapComponent({
      stations,
      incidents = [],
      fires = [],
      selectedStationId,
      onSelectStation,
      showFires = false,
      zoom = 11,
      center = [28.62, 77.21],
    }: MapViewProps) {
      useEffect(() => {
        // Fix default leaflet icons
        delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      }, []);

      const createCustomIcon = (st: StationSummary) => {
        const val = st.latest?.pm25 ? Math.round(st.latest.pm25) : '--';
        const hex = bandHex(st.band);
        const isSelected = st.id === selectedStationId;
        const inc = incidents.find((i) => i.stationId === st.id && (i.status === 'open' || i.status === 'dispatched' || i.status === 'recurred'));
        const hasActiveWo = inc?.workOrders.some((w) => w.status === 'issued' || w.status === 'in_progress');

        const borderStyle = st.isHotspot ? 'border-2 border-black font-extrabold' : 'border border-black font-medium';
        const ringStyle = inc
          ? hasActiveWo
            ? 'outline outline-2 outline-dashed outline-black outline-offset-2'
            : 'outline outline-2 outline-black outline-offset-2'
          : '';

        const badgeHtml = hasActiveWo
          ? '<span style="position:absolute;top:-8px;right:-8px;background:#141414;color:#fff;font-size:9px;padding:1px 3px;font-family:monospace;font-weight:bold;">WO</span>'
          : '';

        const html = `
          <div style="position:relative;width:42px;height:26px;background:${hex};color:#fff;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:12px;cursor:pointer;${borderStyle};${ringStyle};${isSelected ? 'transform:scale(1.15);box-shadow:0 0 0 2px #141414;' : ''}">
            ${val}
            ${badgeHtml}
          </div>
        `;

        return L.divIcon({
          html,
          className: 'custom-station-marker',
          iconSize: [42, 26],
          iconAnchor: [21, 13],
        });
      };

      return (
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={false}
          className="w-full h-full z-10"
          style={{ background: '#E4E2DC' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-greyscale"
          />

          {/* NASA FIRMS Fire Detections Layer */}
          {showFires &&
            fires.map((fire, idx) => (
              <CircleMarker
                key={idx}
                center={[fire.lat, fire.lon]}
                radius={4}
                pathOptions={{
                  color: '#D92D20',
                  fillColor: '#D92D20',
                  fillOpacity: 0.7,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className="font-mono text-xs">
                    <div className="font-bold">Farm Fire Detection</div>
                    <div>FRP: {fire.frp} MW</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

          {/* Stations Markers */}
          {stations.map((st) => (
            <Marker
              key={st.id}
              position={[st.lat, st.lon]}
              icon={createCustomIcon(st)}
              eventHandlers={{
                click: () => onSelectStation?.(st),
              }}
            >
              <Popup>
                <div className="font-sans text-xs p-1">
                  <div className="font-serif font-bold text-sm text-ink">{st.name}</div>
                  <div className="font-mono text-ink-3 mt-0.5">
                    PM2.5: {st.latest?.pm25 ? `${Math.round(st.latest.pm25)} µg/m³` : 'No data'}
                  </div>
                  <div className="font-mono text-ink-3 capitalize">
                    Status: {st.band ? st.band.replace('_', ' ') : 'Offline'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      );
    };
  },
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#E4E2DC] flex items-center justify-center font-mono text-xs text-ink-3">
        Loading map tiles…
      </div>
    ),
  }
);

export function MapView(props: MapViewProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className={`w-full h-full bg-[#E4E2DC] flex items-center justify-center font-mono text-xs text-ink-3 ${props.className || ''}`}>
        Loading map…
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden ${props.className || ''}`}>
      <LeafletMap {...props} />
    </div>
  );
}
