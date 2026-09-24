import React, { useState, useEffect } from 'react';
import {
  Bus,
  Users,
  Navigation,
  AlertTriangle,
  Route as RouteIcon,
  Shield,
  Activity,
  Play,
  Square,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  Sparkles,
  MapPin,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { CampusMap } from '../../components/map/CampusMap.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import { Modal } from '../../components/common/Modal.js';
import type {
  LiveBusTrackingState,
  CampusRoute,
  EmergencyAlert,
  AnalyticsSummary,
  Bus as BusType,
  Driver as DriverType
} from '../../types.js';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'map' | 'buses' | 'drivers' | 'routes' | 'history' | 'analytics'>('map');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activeBuses, setActiveBuses] = useState<LiveBusTrackingState[]>([]);
  const [routes, setRoutes] = useState<CampusRoute[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<DriverType[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAlert[]>([]);
  const [tripHistory, setTripHistory] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isAddBusModalOpen, setIsAddBusModalOpen] = useState(false);
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false);
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);

  // Form states
  const [busForm, setBusForm] = useState({ busNumber: '', registrationNumber: '', capacity: 40, status: 'Not Started' });
  const [driverForm, setDriverForm] = useState({ name: '', email: '', password: '', phone: '', licenseNumber: '', assignedBusId: '' });
  const [routeForm, setRouteForm] = useState({
    name: '',
    description: '',
    color: '#2563EB',
    stops: [
      { name: 'Campus Gate', latitude: 12.9340, longitude: 77.6050, sequence: 1 },
      { name: 'Main Library', latitude: 12.9360, longitude: 77.6080, sequence: 2 }
    ]
  });

  // Load all initial data
  const loadAdminData = async () => {
    try {
      const [analyticsRes, activeTripsRes, routesRes, busesRes, driversRes, emgRes, simRes, historyRes] =
        await Promise.all([
          api.get('/analytics'),
          api.get('/trips/active'),
          api.get('/routes'),
          api.get('/buses'),
          api.get('/drivers'),
          api.get('/emergency'),
          api.get('/simulation/status'),
          api.get('/trips/history')
        ]);

      if (analyticsRes.success) setAnalytics(analyticsRes.data);
      if (activeTripsRes.success) setActiveBuses(activeTripsRes.data);
      if (routesRes.success) setRoutes(routesRes.data);
      if (busesRes.success) setBuses(busesRes.data);
      if (driversRes.success) setDrivers(driversRes.data);
      if (emgRes.success) setEmergencies(emgRes.data);
      if (simRes.success) setIsSimulating(simRes.data.isSimulating);
      if (historyRes.success) setTripHistory(historyRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Real-time socket event updates
  useSocket({
    onLocationUpdate: (update) => {
      setActiveBuses((prev) => {
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

    onEmergencyCreated: (alert) => {
      setEmergencies((prev) => [alert, ...prev]);
      loadAdminData();
    },

    onEmergencyResolved: ({ alertId, busId }) => {
      setEmergencies((prev) =>
        prev.map((e) => (e.id === alertId ? { ...e, status: 'resolved' } : e))
      );
      loadAdminData();
    },

    onOccupancyUpdated: ({ busId, passengerCount }) => {
      setActiveBuses((prev) =>
        prev.map((b) => (b.busId === busId ? { ...b, passengerCount } : b))
      );
    },

    onTripStarted: () => {
      loadAdminData();
    },

    onTripEnded: () => {
      loadAdminData();
    },

    onBusStatusChanged: () => {
      loadAdminData();
    }
  });

  // Emergency resolution
  const handleAcknowledgeEmergency = async (id: string) => {
    try {
      await api.put(`/emergency/${id}/acknowledge`);
      setEmergencies((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'acknowledged' } : e))
      );
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleResolveEmergency = async (id: string) => {
    try {
      await api.put(`/emergency/${id}/resolve`);
      setEmergencies((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'resolved' } : e))
      );
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  // Toggle GPS Simulation
  const handleToggleSimulation = async () => {
    try {
      if (isSimulating) {
        await api.post('/simulation/stop');
        setIsSimulating(false);
      } else {
        await api.post('/simulation/start', { speedMultiplier: 1.0 });
        setIsSimulating(true);
      }
    } catch (err: any) {
      alert(err.message || 'Simulation toggle failed');
    }
  };

  // Bus CRUD
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/buses', busForm);
      setIsAddBusModalOpen(false);
      setBusForm({ busNumber: '', registrationNumber: '', capacity: 40, status: 'Not Started' });
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to create bus');
    }
  };

  const handleDeleteBus = async (id: string) => {
    if (!window.confirm('Delete this bus?')) return;
    try {
      await api.delete(`/buses/${id}`);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bus');
    }
  };

  // Driver CRUD
  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/drivers', driverForm);
      setIsAddDriverModalOpen(false);
      setDriverForm({ name: '', email: '', password: '', phone: '', licenseNumber: '', assignedBusId: '' });
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to create driver');
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!window.confirm('Delete this driver?')) return;
    try {
      await api.delete(`/drivers/${id}`);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete driver');
    }
  };

  // Route CRUD
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/routes', routeForm);
      setIsAddRouteModalOpen(false);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to create route');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!window.confirm('Delete this route?')) return;
    try {
      await api.delete(`/routes/${id}`);
      loadAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete route');
    }
  };

  const activeEmergencies = emergencies.filter((e) => e.status !== 'resolved');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Active Emergency Alert Banner */}
      {activeEmergencies.length > 0 && (
        <div className="p-5 rounded-3xl bg-rose-50 border-2 border-rose-300 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-600 text-white animate-bounce">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-black text-rose-950">
                  CRITICAL TRANSIT EMERGENCY ALERTS ({activeEmergencies.length})
                </h3>
                <p className="text-xs text-rose-700">Immediate response required from campus authorities</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {activeEmergencies.map((emg) => (
              <div
                key={emg.id}
                className="p-3.5 bg-white rounded-2xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">{emg.busNumber}</span>
                    <span className="text-xs text-slate-500">• Driver: {emg.driverName}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        emg.status === 'acknowledged'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {emg.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rose-800 mt-1">{emg.message}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Location: {emg.latitude.toFixed(5)}, {emg.longitude.toFixed(5)} • Reported:{' '}
                    {new Date(emg.createdAt).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {emg.status === 'active' && (
                    <button
                      onClick={() => handleAcknowledgeEmergency(emg.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs"
                    >
                      Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => handleResolveEmergency(emg.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Resolve Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Header & Simulation Controller */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 uppercase tracking-wider">
            Fleet Operations Console
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Campus Transit Management
          </h1>
          <p className="text-xs text-slate-500">Live telematics, driver dispatch, and route operations</p>
        </div>

        {/* GPS Hackathon Simulation Toggle (Req 20) */}
        <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-right">
            <span className="text-xs font-bold text-slate-800 block">GPS Simulation</span>
            <span className="text-[10px] text-slate-400">Demo playback engine</span>
          </div>

          <button
            onClick={handleToggleSimulation}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm ${
              isSimulating
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isSimulating ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Stop Simulation
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Start Demo GPS
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid (Requirement 9) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Fleet</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{analytics?.totalBuses ?? buses.length}</span>
            <Bus className="w-4 h-4 text-sky-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Trips</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-emerald-600">{activeBuses.length}</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Delayed</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-amber-600">{analytics?.delayedBuses ?? 0}</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Emergencies</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-rose-600">{activeEmergencies.length}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Routes</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{routes.length}</span>
            <RouteIcon className="w-4 h-4 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Drivers</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{drivers.length}</span>
            <Navigation className="w-4 h-4 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Avg Occupancy</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-black text-slate-900">{analytics?.averageOccupancyRate ?? 55}%</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Admin Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: 'map', label: '🗺️ Live Fleet Map' },
          { id: 'buses', label: '🚌 Bus Fleet' },
          { id: 'drivers', label: '👨‍✈️ Drivers' },
          { id: 'routes', label: '🛣️ Routes & Stops' },
          { id: 'history', label: '📜 Trip History' },
          { id: 'analytics', label: '📊 Operational Analytics' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Live Fleet Map */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Real-Time Campus GPS Telemetry</h3>
                <p className="text-xs text-slate-500">Live positions updated dynamically via WebSockets</p>
              </div>
              <button
                onClick={loadAdminData}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                title="Refresh Fleet Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <CampusMap buses={activeBuses} routes={routes} height="560px" />
          </div>

          {/* Active Trip Telemetry Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBuses.map((bus) => (
              <div key={bus.busId} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{bus.busNumber}</span>
                  <StatusBadge status={bus.status} size="sm" />
                </div>
                <p className="text-xs text-slate-600">
                  Route: <span className="font-bold text-slate-800">{bus.routeName}</span> • Driver: {bus.driverName}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                  <span>Speed: {bus.speed} km/h</span>
                  <span>Occupancy: {bus.passengerCount}/{bus.capacity}</span>
                </div>
                {bus.nextStop && (
                  <div className="text-[11px] font-bold text-sky-800 bg-sky-50 p-2 rounded-xl">
                    Next Stop: {bus.nextStop.stopName} (~{bus.nextStop.etaMinutes} min)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Bus Fleet Management */}
      {activeTab === 'buses' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Campus Buses</h3>
              <p className="text-xs text-slate-500">Manage campus shuttles and vehicles</p>
            </div>
            <button
              onClick={() => setIsAddBusModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add Bus
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bus Identifier</th>
                  <th className="py-3 px-4">Registration</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Current Driver</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buses.map((bus) => (
                  <tr key={bus.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">{bus.busNumber}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{bus.registrationNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{bus.capacity} seats</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={bus.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-slate-600">{bus.driverName || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteBus(bus.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Bus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Driver Management */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Drivers Registry</h3>
              <p className="text-xs text-slate-500">Authorized campus drivers and vehicle assignments</p>
            </div>
            <button
              onClick={() => setIsAddDriverModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">License</th>
                  <th className="py-3 px-4">Assigned Bus</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((drv) => (
                  <tr key={drv.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">{drv.name}</td>
                    <td className="py-3 px-4 text-slate-600">{drv.email}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{drv.licenseNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{drv.busNumber || 'None'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteDriver(drv.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                        title="Delete Driver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Route Management */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Campus Routes & Stops</h3>
              <p className="text-xs text-slate-500">Scheduled campus shuttle transit lines</p>
            </div>
            <button
              onClick={() => setIsAddRouteModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" /> Add Route
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {routes.map((route) => (
              <div key={route.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: route.color }} />
                    <h4 className="font-extrabold text-sm text-slate-900">{route.name}</h4>
                  </div>
                  <button
                    onClick={() => handleDeleteRoute(route.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-500">{route.description}</p>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Sequence of Stops ({route.stops?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {route.stops?.map((stop) => (
                      <span
                        key={stop.id}
                        className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-700"
                      >
                        {stop.sequence}. {stop.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Trip History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Trip Audit Log</h3>
            <p className="text-xs text-slate-500">Historical records of completed trips and telemetry</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Bus</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Start Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">GPS Coordinates Logged</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tripHistory.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-bold text-slate-800">{trip.busNumber}</td>
                    <td className="py-3 px-4 text-slate-600">{trip.routeName}</td>
                    <td className="py-3 px-4 text-slate-600">{trip.driverName}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(trip.startTime).toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {trip.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{trip.totalGpsPings || 0} pings</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Operational Analytics */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Fleet Efficiency & Punctuality</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>On-Time Dispatch Rate</span>
                <span className="font-bold text-emerald-600">94.2%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '94%' }} />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Average Seat Capacity Utilization</span>
                <span className="font-bold text-sky-600">{analytics?.averageOccupancyRate ?? 60}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full"
                  style={{ width: `${analytics?.averageOccupancyRate ?? 60}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Safety & Incident Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800">
                <span className="text-xl font-black">
                  {emergencies.filter((e) => e.status === 'resolved').length}
                </span>
                <span className="text-[10px] block font-semibold mt-0.5">Resolved Alerts</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 text-rose-800">
                <span className="text-xl font-black">{activeEmergencies.length}</span>
                <span className="text-[10px] block font-semibold mt-0.5">Active Emergencies</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Campus Security Response Avg: <span className="font-bold text-slate-700">2.4 minutes</span>
            </p>
          </div>
        </div>
      )}

      {/* Add Bus Modal */}
      <Modal isOpen={isAddBusModalOpen} onClose={() => setIsAddBusModalOpen(false)} title="Add Campus Bus">
        <form onSubmit={handleCreateBus} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bus Number / Label</label>
            <input
              type="text"
              required
              placeholder="Bus 606 - North Ring"
              value={busForm.busNumber}
              onChange={(e) => setBusForm({ ...busForm, busNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">License Plate Number</label>
            <input
              type="text"
              required
              placeholder="KA-01-CB-6060"
              value={busForm.registrationNumber}
              onChange={(e) => setBusForm({ ...busForm, registrationNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Seating Capacity</label>
            <input
              type="number"
              required
              min="10"
              max="90"
              value={busForm.capacity}
              onChange={(e) => setBusForm({ ...busForm, capacity: parseInt(e.target.value, 10) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddBusModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              Create Bus
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Driver Modal */}
      <Modal isOpen={isAddDriverModalOpen} onClose={() => setIsAddDriverModalOpen(false)} title="Register Driver">
        <form onSubmit={handleCreateDriver} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              placeholder="Prakash Rao"
              value={driverForm.name}
              onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              placeholder="prakash@campus.edu"
              value={driverForm.email}
              onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">License Number</label>
            <input
              type="text"
              required
              placeholder="DL-2023-998811"
              value={driverForm.licenseNumber}
              onChange={(e) => setDriverForm({ ...driverForm, licenseNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={driverForm.password}
              onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to Bus (Optional)</label>
            <select
              value={driverForm.assignedBusId}
              onChange={(e) => setDriverForm({ ...driverForm, assignedBusId: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            >
              <option value="">No assignment</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.busNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddDriverModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              Register Driver
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Route Modal */}
      <Modal isOpen={isAddRouteModalOpen} onClose={() => setIsAddRouteModalOpen(false)} title="Create Campus Route">
        <form onSubmit={handleCreateRoute} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Route Name</label>
            <input
              type="text"
              required
              placeholder="Route 4: Sports & Hostel Express"
              value={routeForm.name}
              onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="Direct express route between sports arena and hostels"
              value={routeForm.description}
              onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Route Color (Hex)</label>
            <input
              type="color"
              value={routeForm.color}
              onChange={(e) => setRouteForm({ ...routeForm, color: e.target.value })}
              className="w-16 h-10 rounded-xl border border-slate-200 cursor-pointer"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddRouteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              Create Route
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
