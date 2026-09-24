import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LiveBusTrackingState, CampusRoute, RouteStop } from '../../types.js';

interface CampusMapProps {
  buses: LiveBusTrackingState[];
  routes?: CampusRoute[];
  selectedBusId?: string | null;
  onSelectBus?: (busId: string) => void;
  driverCurrentLocation?: { latitude: number; longitude: number; accuracy?: number } | null;
  height?: string;
  zoom?: number;
  center?: [number, number];
}

export const CampusMap: React.FC<CampusMapProps> = ({
  buses,
  routes = [],
  selectedBusId,
  onSelectBus,
  driverCurrentLocation,
  height = '500px',
  zoom = 15,
  center = [12.9360, 77.6075] // Default campus center
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const busMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const driverCircleRef = useRef<L.Circle | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true
    });

    // Clean, modern map tile layer (CartoDB Positron for modern transit look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Route Polylines & Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean existing routes and stops
    routePolylinesRef.current.forEach((line) => line.remove());
    routePolylinesRef.current.clear();

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    routes.forEach((route) => {
      if (!route.stops || route.stops.length < 2) return;

      const stopCoords = route.stops.map((s) => [s.latitude, s.longitude] as [number, number]);

      // Route polyline
      const polyline = L.polyline(stopCoords, {
        color: route.color || '#2563EB',
        weight: 4,
        opacity: 0.75,
        dashArray: route.status === 'inactive' ? '5, 8' : undefined
      }).addTo(map);

      routePolylinesRef.current.set(route.id, polyline);

      // Add Stop Markers
      route.stops.forEach((stop: RouteStop) => {
        const stopIcon = L.divIcon({
          className: 'custom-stop-icon',
          html: `
            <div style="background-color: ${route.color || '#2563EB'};" class="stop-marker-badge w-6 h-6">
              ${stop.sequence}
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const stopMarker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .bindPopup(`
            <div class="p-1 font-sans">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">${route.name}</span>
              <p class="font-bold text-slate-800 text-sm">Stop ${stop.sequence}: ${stop.name}</p>
            </div>
          `)
          .addTo(map);

        stopMarkersRef.current.push(stopMarker);
      });
    });
  }, [routes]);

  // Update Bus Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentBusIds = new Set(buses.map((b) => b.busId));

    // Remove old buses
    busMarkersRef.current.forEach((marker, busId) => {
      if (!currentBusIds.has(busId)) {
        marker.remove();
        busMarkersRef.current.delete(busId);
      }
    });

    // Update or add buses
    buses.forEach((bus) => {
      const isSelected = bus.busId === selectedBusId;
      const isEmergency = bus.status === 'Emergency' || bus.isEmergency;
      const color = isEmergency ? '#EF4444' : bus.routeColor || '#0284C7';
      const heading = bus.speed > 3 ? (bus as any).heading || 0 : 0;

      const htmlContent = `
        <div class="bus-marker-container relative">
          ${
            isEmergency
              ? `<div class="absolute -inset-3 rounded-full bg-rose-500/30 animate-ping"></div>
                 <div class="absolute -inset-2 rounded-full border-2 border-rose-600 pulse-emergency"></div>`
              : ''
          }
          <div style="background-color: ${color};" class="flex items-center gap-1 px-2 py-1 rounded-xl text-white shadow-lg font-bold text-xs border-2 ${
            isSelected ? 'border-amber-300 ring-4 ring-sky-300 scale-110' : 'border-white'
          }">
            <svg style="transform: rotate(${heading}deg); transition: transform 0.4s ease;" class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
            <span class="whitespace-nowrap">${bus.busNumber.split(' - ')[0] || bus.busNumber}</span>
          </div>
        </div>
      `;

      const busIcon = L.divIcon({
        className: 'custom-bus-icon',
        html: htmlContent,
        iconSize: [60, 30],
        iconAnchor: [30, 15]
      });

      let marker = busMarkersRef.current.get(bus.busId);

      if (marker) {
        marker.setLatLng([bus.latitude, bus.longitude]);
        marker.setIcon(busIcon);
      } else {
        marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon }).addTo(map);

        marker.on('click', () => {
          onSelectBus?.(bus.busId);
        });

        busMarkersRef.current.set(bus.busId, marker);
      }

      // Popup Content
      marker.bindPopup(`
        <div class="p-1 min-w-[180px]">
          <div class="flex items-center justify-between pb-1 mb-1 border-b">
            <span class="font-extrabold text-sm text-slate-800">${bus.busNumber}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isEmergency ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
            }">${bus.status}</span>
          </div>
          <p class="text-xs text-slate-600 mb-1">Route: <span class="font-semibold text-slate-800">${bus.routeName}</span></p>
          <p class="text-xs text-slate-600 mb-1">Driver: <span class="font-semibold text-slate-800">${bus.driverName}</span></p>
          <p class="text-xs text-slate-600 mb-1">Speed: <span class="font-semibold text-slate-800">${bus.speed} km/h</span></p>
          <p class="text-xs text-slate-600 mb-1">Occupancy: <span class="font-semibold text-slate-800">${bus.passengerCount}/${bus.capacity} seats</span></p>
          ${
            bus.nextStop
              ? `<div class="mt-2 pt-1 border-t text-xs text-sky-700 font-bold bg-sky-50 p-1.5 rounded">
                   Next: ${bus.nextStop.stopName} (~${bus.nextStop.etaMinutes} min)
                 </div>`
              : ''
          }
        </div>
      `);
    });
  }, [buses, selectedBusId, onSelectBus]);

  // Update Driver Current GPS marker (if viewing from Driver Cockpit)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!driverCurrentLocation) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      if (driverCircleRef.current) {
        driverCircleRef.current.remove();
        driverCircleRef.current = null;
      }
      return;
    }

    const { latitude, longitude, accuracy = 5 } = driverCurrentLocation;

    const driverIcon = L.divIcon({
      className: 'driver-live-gps',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-lg ring-4 ring-blue-400/40"></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([latitude, longitude]);
    } else {
      driverMarkerRef.current = L.marker([latitude, longitude], { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
    }

    if (driverCircleRef.current) {
      driverCircleRef.current.setLatLng([latitude, longitude]);
      driverCircleRef.current.setRadius(accuracy);
    } else {
      driverCircleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: '#2563EB',
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        weight: 1
      }).addTo(map);
    }
  }, [driverCurrentLocation]);

  // Fit bounds helper
  const handleFitBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds = L.latLngBounds([]);

    // Collect all bus coords
    buses.forEach((b) => bounds.extend([b.latitude, b.longitude]));

    // Collect all stops
    routes.forEach((r) => r.stops?.forEach((s) => bounds.extend([s.latitude, s.longitude])));

    if (driverCurrentLocation) {
      bounds.extend([driverCurrentLocation.latitude, driverCurrentLocation.longitude]);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-md border border-slate-200">
      <div ref={mapContainerRef} style={{ height }} />

      {/* Map Overlay Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleFitBounds}
          className="p-2.5 bg-white/90 backdrop-blur hover:bg-white text-slate-700 font-semibold text-xs rounded-xl shadow-md border border-slate-200 transition hover:scale-105"
          title="Fit all buses & campus stops in view"
        >
          🎯 Recenter Fleet
        </button>
      </div>

      {/* Legend at bottom left */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center gap-3 px-3 py-1.5 bg-white/90 backdrop-blur rounded-xl shadow-md border border-slate-200 text-xs">
        <span className="font-bold text-slate-700">Fleet:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>On Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          <span className="font-semibold text-rose-600">Emergency</span>
        </div>
      </div>
    </div>
  );
};
