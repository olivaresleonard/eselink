'use client';

import { DivIcon, LatLngBoundsExpression } from 'leaflet';
import { useEffect } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

type FlexMapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  customerName: string;
  address: string;
  stageLabel: string;
  selected?: boolean;
};

function buildPinIcon(selected = false) {
  return new DivIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        width: ${selected ? 26 : 22}px;
        height: ${selected ? 26 : 22}px;
        border-radius: 9999px 9999px 9999px 0;
        transform: rotate(-45deg);
        background: ${selected ? '#0f172a' : '#0b7bff'};
        border: 3px solid ${selected ? '#5eead4' : '#dbeafe'};
        box-shadow: 0 10px 22px rgba(15, 23, 42, 0.24);
      ">
        <div style="
          position: absolute;
          inset: 50% auto auto 50%;
          width: ${selected ? 8 : 7}px;
          height: ${selected ? 8 : 7}px;
          border-radius: 9999px;
          background: white;
          transform: translate(-50%, -50%) rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [selected ? 26 : 22, selected ? 26 : 22],
    iconAnchor: [selected ? 7 : 6, selected ? 26 : 22],
    popupAnchor: [8, -22],
  });
}

function MapBounds({ points }: { points: FlexMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      const [firstPoint] = points;
      if (!firstPoint) {
        return;
      }

      map.flyTo([firstPoint.lat, firstPoint.lng], 14, {
        duration: 0.6,
      });
      return;
    }

    const bounds: LatLngBoundsExpression = points.map((point) => [point.lat, point.lng]);
    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
}

export function FlexTodayMap({
  points,
  onSelect,
}: {
  points: FlexMapPoint[];
  onSelect?: (id: string) => void;
}) {
  const fallbackCenter: [number, number] = [-33.4489, -70.6693];

  return (
    <MapContainer
      center={points[0] ? [points[0].lat, points[0].lng] : fallbackCenter}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapBounds points={points} />

      {points.map((point) => (
        <Marker
          key={point.id}
          position={[point.lat, point.lng]}
          icon={buildPinIcon(point.selected)}
          eventHandlers={{
            click: () => onSelect?.(point.id),
          }}
        >
          <Popup>
            <div className="space-y-1 text-sm text-slate-800">
              <p className="font-semibold">{point.title}</p>
              <p>{point.customerName}</p>
              <p className="text-slate-600">{point.address}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {point.stageLabel}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
