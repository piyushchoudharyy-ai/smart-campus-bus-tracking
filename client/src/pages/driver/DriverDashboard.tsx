import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  AlertTriangle,
  Wifi,
  WifiOff,
  Navigation,
  RefreshCw,
  Plus,
  Minus,
  MapPin,
  Clock,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { api } from '../../services/api.js';
import { useOfflineSync } from '../../hooks/useOfflineSync.js';
import { offlineStorage } from '../../services/offlineStorage.js';
import { campusTracker, GeolocationFix } from '../../services/geolocation.js';
import { CampusMap } from '../../components/map/CampusMap.js';
import { Modal } from '../../components/common/Modal.js';
import type { CampusRoute, LiveBusTrackingState } from '../../types.js';

export const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const { isOnline, isSyncing, pendingCount, triggerSync, refreshPendingCount } = useOfflineSync();

  // Trip and Driver State
  const [assignedBus, setAssignedBus] = useState<any>(null);
  const [assignedRoute, setAssignedRoute] = useState<CampusRoute | null>(null);
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [allRoutes, setAllRoutes] = useState<CampusRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // GPS Tracking State
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'tracking' | 'denied' | 'error'>('idle');
  const [currentFix, setCurrentFix] = useState<GeolocationFix | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);

  // Occupancy State
  const [passengerCount, setPassengerCount] = useState<number>(0);

  // Emergency Modal
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('Mechanical breakdown');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeTripRef = useRef<any>(null);
  activeTripRef.current = activeTrip;

  // Fetch driver assignments and active trips
  const loadDriverData = async () => {
    try {
      const [busesRes, routesRes, tripsRes] = await Promise.all([
        api.get('/buses'),
        api.get('/routes'),
        api.get('/trips/active')
      ]);

      if (routesRes.success) {
        setAllRoutes(routesRes.data);
        if (routesRes.data.length > 0 && !selectedRouteId) {
          setSelectedRouteId(routesRes.data[0].id);
        }
      }

      // Find assigned bus for this driver
      let myBus = null;
      if (busesRes.success) {
        myBus = busesRes.data.find(
          (b: any) =>
            b.id === user?.assignedBusId ||
            b.driverName === user?.name ||
            b.id === 'bus-101' // Fallback demo default
        );
        setAssignedBus(myBus || busesRes.data[0]);
      }

      // Check for active trip
      if (tripsRes.success && Array.isArray(tripsRes.data)) {
        const busIdToCheck = myBus?.id || user?.assignedBusId || 'bus-101';
        const trip = tripsRes.data.find((t: any) => t.busId === busIdToCheck);
        if (trip) {
          setActiveTrip(trip);
          setPassengerCount(trip.passengerCount || 0);
          if (trip.routeId) setSelectedRouteId(trip.routeId);
          if (trip.isEmergency) setIsEmergencyActive(true);

          // Auto-start GPS tracker if trip is already active
          startGpsTracking(trip.tripId, trip.busId);
        }
      }
    } catch (err) {
      console.error('Failed to load driver state:', err);
    }
  };

  useEffect(() => {
    loadDriverData();
    return () => {
      campusTracker.stopTracking();
    };
  }, [user]);

  // Start GPS Tracking
  const startGpsTracking = (tripId: string, busId: string) => {
    setGpsStatus('tracking');

    campusTracker.startTracking({
      onLocation: async (fix) => {
        setCurrentFix(fix);
        setGpsAccuracy(fix.accuracy);
        setGpsSpeed(fix.speed);

        const locationPayload = {
          tripId,
          busId,
          driverId: user?.driverId,
          latitude: fix.latitude,
          longitude: fix.longitude,
          speed: fix.speed,
          accuracy: fix.accuracy,
          heading: fix.heading,
          timestamp: fix.timestamp
        };

        if (navigator.onLine) {
          try {
            await api.post('/location', locationPayload);
          } catch (err) {
            // Offline fallback: save to IndexedDB
            console.warn('Network transmission failed, buffering coordinate to IndexedDB');
            await offlineStorage.enqueueLocation(locationPayload);
            await refreshPendingCount();
          }
        } else {
          // Device is offline: save directly to IndexedDB queue!
          console.log('Device is offline. Queuing coordinate in local IndexedDB...');
          await offlineStorage.enqueueLocation(locationPayload);
          await refreshPendingCount();
        }
      },
      onError: (err) => {
        console.error('GPS tracking error:', err);
        if ((err as GeolocationPositionError).code === 1) {
          setGpsStatus('denied');
        } else {
          setGpsStatus('error');
        }
      }
    });
  };

  // Start Trip Button
  const handleStartTrip = async () => {
    if (!assignedBus || !selectedRouteId) return;
    setIsLoading(true);

    try {
      const res = await api.post('/trips/start', {
        busId: assignedBus.id,
        routeId: selectedRouteId,
        driverId: user?.driverId
      });

      if (res.success && res.data) {
        setActiveTrip(res.data);
        startGpsTracking(res.data.id, assignedBus.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start trip');
    } finally {
      setIsLoading(false);
    }
  };

  // End Trip Button
  const handleEndTrip = async () => {
    if (!activeTrip) return;
    const confirmEnd = window.confirm('Are you sure you want to end this campus bus trip?');
    if (!confirmEnd) return;

    setIsLoading(true);
    try {
      await api.post(`/trips/${activeTrip.id || activeTrip.tripId}/end`);
      campusTracker.stopTracking();
      setActiveTrip(null);
      setGpsStatus('idle');
      setCurrentFix(null);
      setIsEmergencyActive(false);

      // Trigger offline sync if any remaining points
      triggerSync();
    } catch (err: any) {
      alert(err.message || 'Failed to end trip');
    } finally {
      setIsLoading(false);
    }
  };

  // Update Occupancy
  const handleUpdateOccupancy = async (delta: number) => {
    if (!activeTrip) return;
    const maxCapacity = assignedBus?.capacity || 40;
    const newCount = Math.max(0, Math.min(maxCapacity, passengerCount + delta));
    setPassengerCount(newCount);

    try {
      await api.post('/occupancy', {
        tripId: activeTrip.id || activeTrip.tripId,
        passengerCount: newCount
      });
    } catch (err) {
      console.warn('Could not sync occupancy immediately');
    }
  };

  // Report Emergency
  const handleReportEmergency = async () => {
    if (!activeTrip) {
      alert('Trip must be active to trigger an emergency alert.');
      return;
    }

    const lat = currentFix?.latitude || 12.936;
    const lng = currentFix?.longitude || 77.607;

    try {
      await api.post('/emergency', {
        tripId: activeTrip.id || activeTrip.tripId,
        busId: assignedBus.id,
        driverId: user?.driverId,
        message: emergencyReason,
        latitude: lat,
        longitude: lng
      });

      setIsEmergencyActive(true);
      setIsEmergencyModalOpen(false);
      alert('Emergency alert sent to campus administrators and transit control.');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch emergency alert');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner: Emergency Status if Active */}
      {isEmergencyActive && (
        <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-xl flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 shrink-0" />
            <div>
              <h2 className="text-base font-black">EMERGENCY PROTOCOL ACTIVE</h2>
              <p className="text-xs text-rose-100">
                Transit operations and safety units notified. Real-time GPS broadcasting at high frequency.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Driver Cockpit Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 uppercase tracking-wider">
            Driver Cockpit
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 mt-1">
            Welcome, {user?.name || 'Driver'}
          </h1>
          <p className="text-xs text-slate-500">
            Assigned Bus: <span className="font-bold text-slate-800">{assignedBus?.busNumber || 'Bus 101'}</span> •{' '}
            Plate: <span className="font-bold text-slate-800">{assignedBus?.registrationNumber || 'KA-01-CB-1011'}</span>
          </p>
        </div>

        {/* Big Start / End Trip CTA */}
        <div>
          {activeTrip ? (
            <button
              onClick={handleEndTrip}
              disabled={isLoading}
              className="w-full sm:w-auto px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5 fill-current" />
              END TRIP
            </button>
          ) : (
            <button
              onClick={handleStartTrip}
              disabled={isLoading}
              className="w-full sm:w-auto px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              START TRIP & GPS
            </button>
          )}
        </div>
      </div>

      {/* Critical Status Cards: GPS & Internet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: GPS Hardware Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Smartphone GPS Status
            </span>
            {gpsStatus === 'tracking' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                GPS Active
              </span>
            ) : gpsStatus === 'denied' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                Permission Denied
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                Idle (Standby)
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-xl bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-semibold">Speed</span>
              <span className="text-base font-black text-slate-800">
                {gpsSpeed !== null ? `${gpsSpeed} km/h` : '--'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-semibold">Accuracy</span>
              <span className="text-base font-black text-slate-800">
                {gpsAccuracy !== null ? `±${gpsAccuracy}m` : '--'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-slate-50">
              <span className="text-[10px] text-slate-400 block font-semibold">Interval</span>
              <span className="text-base font-black text-slate-800">Adaptive</span>
            </div>
          </div>

          {currentFix && (
            <p className="text-[11px] text-slate-400 font-mono text-center">
              Fix: {currentFix.latitude.toFixed(6)}, {currentFix.longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* Card 2: Offline-First Queue & Sync Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Connectivity & Sync
            </span>
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Wifi className="w-3.5 h-3.5" />
                Internet Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <WifiOff className="w-3.5 h-3.5" />
                Offline Mode Active
              </span>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">IndexedDB Offline Queue</p>
              <p className="text-[11px] text-slate-500">
                {pendingCount > 0
                  ? `${pendingCount} GPS updates saved locally`
                  : 'Zero pending updates. Synchronized with server.'}
              </p>
            </div>
            {pendingCount > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing || !isOnline}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            * GPS updates continue recording even without cellular coverage. Automatically syncs on reconnect.
          </p>
        </div>
      </div>

      {/* Route Selection (If Not Active) */}
      {!activeTrip && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Route Before Commencing Trip
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {allRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelectedRouteId(route.id)}
                className={`p-3 rounded-2xl border text-left transition ${
                  selectedRouteId === route.id
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: route.color }} />
                  <span className="font-extrabold text-xs text-slate-900">{route.name}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{route.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Driver Controls: Occupancy & Emergency */}
      {activeTrip && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Passenger Occupancy Control */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Passenger Count / Occupancy
            </span>

            <div className="flex items-center justify-between">
              <button
                onClick={() => handleUpdateOccupancy(-1)}
                className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-2xl transition active:scale-95"
              >
                <Minus className="w-6 h-6" />
              </button>

              <div className="text-center">
                <span className="text-4xl font-black text-slate-900">{passengerCount}</span>
                <span className="text-xs text-slate-400 block font-semibold">
                  / {assignedBus?.capacity || 40} capacity
                </span>
              </div>

              <button
                onClick={() => handleUpdateOccupancy(1)}
                className="w-14 h-14 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center font-black text-2xl shadow-md shadow-sky-600/20 transition active:scale-95"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {[0, 10, 20, 30, assignedBus?.capacity || 40].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setPassengerCount(num);
                    handleUpdateOccupancy(num - passengerCount);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Emergency Alert Button */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Emergency Hotline
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Dispatches urgent alert with exact coordinates to campus safety, control room, and admin console.
              </p>
            </div>

            <button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-600/30 transition flex items-center justify-center gap-2 active:scale-98"
            >
              <AlertTriangle className="w-5 h-5" />
              🚨 REPORT EMERGENCY
            </button>
          </div>
        </div>
      )}

      {/* Driver Live Map View */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Live Route & Vehicle Position
          </span>
          <span className="text-xs text-slate-400 font-medium">Auto-following vehicle GPS</span>
        </div>

        <CampusMap
          buses={
            activeTrip
              ? [
                  {
                    busId: assignedBus?.id || 'bus-101',
                    busNumber: assignedBus?.busNumber || 'Bus 101',
                    routeId: selectedRouteId,
                    routeName: 'Active Route',
                    routeColor: '#2563EB',
                    driverId: user?.driverId || 'drv-1',
                    driverName: user?.name || 'Driver',
                    tripId: activeTrip.id || activeTrip.tripId,
                    status: isEmergencyActive ? 'Emergency' : 'On Time',
                    latitude: currentFix?.latitude || 12.9358,
                    longitude: currentFix?.longitude || 77.6075,
                    speed: currentFix?.speed || 0,
                    accuracy: currentFix?.accuracy || 5,
                    passengerCount,
                    capacity: assignedBus?.capacity || 40,
                    lastUpdated: currentFix?.timestamp || new Date().toISOString(),
                    upcomingStops: [],
                    isEmergency: isEmergencyActive
                  }
                ]
              : []
          }
          routes={allRoutes.filter((r) => r.id === selectedRouteId)}
          driverCurrentLocation={currentFix}
          height="380px"
          center={[currentFix?.latitude || 12.936, currentFix?.longitude || 77.6075]}
        />
      </div>

      {/* Emergency Confirmation Modal */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="⚠️ Confirm Emergency Alert"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please select the reason for the emergency. Your current GPS coordinates will be sent immediately to Campus Security.
          </p>

          <div className="space-y-2">
            {[
              'Mechanical breakdown / Engine fault',
              'Medical emergency on board',
              'Vehicle accident / Collision',
              'Road blocked / Severe obstruction',
              'Security / Student safety concern'
            ].map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-800"
              >
                <input
                  type="radio"
                  name="emergencyReason"
                  checked={emergencyReason === reason}
                  onChange={() => setEmergencyReason(reason)}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => setIsEmergencyModalOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReportEmergency}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              Transmit Alert
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
