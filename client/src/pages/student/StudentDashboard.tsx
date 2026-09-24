import React, { useState, useEffect } from 'react';
import { Bus, MapPin, Clock, Users, AlertTriangle, ArrowRight, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../../services/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { CampusMap } from '../../components/map/CampusMap.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import type { LiveBusTrackingState, CampusRoute, EmergencyAlert } from '../../types.js';

export const StudentDashboard: React.FC = () => {
  const [buses, setBuses] = useState<LiveBusTrackingState[]>([]);
  const [routes, setRoutes] = useState<CampusRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('all');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [tripsRes, routesRes, emgRes] = await Promise.all([
        api.get('/trips/active'),
        api.get('/routes'),
        api.get('/emergency')
      ]);

      if (tripsRes.success && Array.isArray(tripsRes.data)) {
        setBuses(tripsRes.data);
        if (tripsRes.data.length > 0 && !selectedBusId) {
          setSelectedBusId(tripsRes.data[0].busId);
        }
      }

      if (routesRes.success && Array.isArray(routesRes.data)) {
        setRoutes(routesRes.data);
      }

      if (emgRes.success && Array.isArray(emgRes.data)) {
        const activeEmg = emgRes.data.filter((e: EmergencyAlert) => e.status !== 'resolved');
        setEmergencies(activeEmg);
      }
    } catch (err) {
      console.error('Error loading student dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time socket event bindings
  useSocket({
    onLocationUpdate: (update) => {
      setBuses((prev) => {
        const exists = prev.some((b) => b.busId === update.busId);
        if (exists) {
          return prev.map((b) =>
            b.busId === update.busId
              ? {
                  ...b,
                  latitude: update.latitude,
                  longitude: update.longitude,
                  speed: update.speed ?? b.speed,
                  accuracy: update.accuracy ?? b.accuracy,
                  lastUpdated: update.timestamp,
                  upcomingStops: update.upcomingStops || b.upcomingStops,
                  nextStop: update.nextStop || b.nextStop,
                  heading: update.heading
                }
              : b
          );
        }
        return prev;
      });
    },

    onBusStatusChanged: ({ busId, status }) => {
      setBuses((prev) =>
        prev.map((b) =>
          b.busId === busId
            ? {
                ...b,
                status: status as any,
                isEmergency: status === 'Emergency'
              }
            : b
        )
      );
    },

    onOccupancyUpdated: ({ busId, passengerCount }) => {
      setBuses((prev) =>
        prev.map((b) => (b.busId === busId ? { ...b, passengerCount } : b))
      );
    },

    onTripStarted: () => {
      fetchData();
    },

    onTripEnded: ({ busId }) => {
      setBuses((prev) => prev.filter((b) => b.busId !== busId));
      if (selectedBusId === busId) {
        setSelectedBusId(null);
      }
    },

    onEmergencyCreated: (alert) => {
      setEmergencies((prev) => [alert, ...prev.filter((e) => e.id !== alert.id)]);
      setBuses((prev) =>
        prev.map((b) => (b.busId === alert.busId ? { ...b, status: 'Emergency', isEmergency: true } : b))
      );
    },

    onEmergencyResolved: ({ alertId, busId }) => {
      setEmergencies((prev) => prev.filter((e) => e.id !== alertId));
      setBuses((prev) =>
        prev.map((b) => (b.busId === busId ? { ...b, status: 'On Time', isEmergency: false } : b))
      );
    }
  });

  // Filtered buses
  const filteredBuses =
    selectedRouteId === 'all'
      ? buses
      : buses.filter((b) => b.routeId === selectedRouteId);

  // Selected bus
  const currentBus = buses.find((b) => b.busId === selectedBusId) || buses[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Emergency Alert Banner */}
      {emergencies.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-md animate-pulse">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-rose-900">
                  🚨 Active Campus Transit Emergency
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                  Campus Alert
                </span>
              </div>
              <p className="text-sm text-rose-800 mt-1 font-medium">
                {emergencies[0].busNumber || 'Bus'}: {emergencies[0].message}
              </p>
              <p className="text-xs text-rose-600 mt-0.5">
                Authorities & Campus Security have been alerted. Bus location is being monitored in real time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header & Route Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Live Campus Buses
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
              {buses.length} active
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS tracker with live stop arrival estimates
          </p>
        </div>

        {/* Route Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedRouteId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              selectedRouteId === 'all'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Routes
          </button>
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => setSelectedRouteId(route.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                selectedRouteId === route.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: route.color }}
              />
              <span>{route.name.split(':')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Interactive Map + Live Bus Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Interactive Map */}
        <div className="lg:col-span-2 space-y-4">
          <CampusMap
            buses={filteredBuses}
            routes={routes.filter(
              (r) => selectedRouteId === 'all' || r.id === selectedRouteId
            )}
            selectedBusId={selectedBusId}
            onSelectBus={(id) => setSelectedBusId(id)}
            height="520px"
          />

          {/* Quick Active Buses Slider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredBuses.map((bus) => {
              const isSelected = bus.busId === selectedBusId;
              const occPercent = Math.round((bus.passengerCount / (bus.capacity || 40)) * 100);

              return (
                <div
                  key={bus.busId}
                  onClick={() => setSelectedBusId(bus.busId)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-sky-50/70 border-sky-400 shadow-md ring-2 ring-sky-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-sm text-slate-800">
                      {bus.busNumber.split(' - ')[0]}
                    </span>
                    <StatusBadge status={bus.status} size="sm" />
                  </div>

                  <p className="text-xs text-slate-600 truncate mb-2">
                    {bus.routeName}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-sky-600" />
                      {bus.nextStop ? `~${bus.nextStop.etaMinutes}m` : 'In transit'}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Users className="w-3 h-3 text-slate-400" />
                      {occPercent}% full
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Bus Deep Dive & ETA Schedule */}
        <div className="space-y-4">
          {currentBus ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              {/* Bus Header */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: currentBus.routeColor || '#0284C7' }}
                  >
                    {currentBus.routeName}
                  </span>
                  <StatusBadge status={currentBus.status} size="md" />
                </div>
                <h2 className="text-xl font-black text-slate-900">
                  {currentBus.busNumber}
                </h2>
                <p className="text-xs text-slate-500">
                  Driver: <span className="font-semibold text-slate-700">{currentBus.driverName}</span>
                </p>
              </div>

              {/* Next Stop Highlight Card */}
              {currentBus.nextStop ? (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-100 block">
                    Next Stop Approaching
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <h3 className="text-lg font-black truncate max-w-[70%]">
                      {currentBus.nextStop.stopName}
                    </h3>
                    <div className="text-right">
                      <span className="text-2xl font-black">
                        ~{currentBus.nextStop.etaMinutes}
                      </span>
                      <span className="text-xs font-semibold ml-1">min</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-sky-100 mt-2 pt-2 border-t border-white/20">
                    <span>Dist: {currentBus.nextStop.distanceKm} km</span>
                    <span>•</span>
                    <span>Speed: {currentBus.speed} km/h</span>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  Bus has completed all scheduled stops on this loop
                </div>
              )}

              {/* Occupancy Indicator */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    Seat Availability
                  </span>
                  <span>
                    {currentBus.passengerCount} / {currentBus.capacity} seats ({Math.round(
                      (currentBus.passengerCount / (currentBus.capacity || 40)) * 100
                    )}%)
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentBus.passengerCount / currentBus.capacity > 0.85
                        ? 'bg-rose-500'
                        : currentBus.passengerCount / currentBus.capacity > 0.6
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (currentBus.passengerCount / (currentBus.capacity || 40)) * 100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Upcoming Stops Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Upcoming Route Checkpoints
                </h4>

                <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {currentBus.upcomingStops && currentBus.upcomingStops.length > 0 ? (
                    currentBus.upcomingStops.map((stop, idx) => (
                      <div key={stop.stopId} className="flex items-start gap-3 relative pl-1">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 z-10 shadow-xs ${
                            idx === 0 ? 'bg-sky-600 ring-4 ring-sky-100' : 'bg-slate-400'
                          }`}
                        >
                          {stop.sequence}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center justify-between text-xs">
                          <div>
                            <p
                              className={`font-bold truncate ${
                                idx === 0 ? 'text-sky-900 text-sm' : 'text-slate-700'
                              }`}
                            >
                              {stop.stopName}
                            </p>
                            <span className="text-[11px] text-slate-400">
                              {stop.distanceKm} km away
                            </span>
                          </div>
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-md ${
                              idx === 0
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            ~{stop.etaMinutes} min
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No remaining stops on this loop</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-400">
              <Bus className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-600">No Active Buses</p>
              <p className="text-xs text-slate-400 mt-1">
                Drivers have not commenced trips yet, or check back during campus service hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
