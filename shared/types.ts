export type UserRole = 'student' | 'driver' | 'admin';

export type BusStatus = 'Not Started' | 'On Time' | 'Delayed' | 'Completed' | 'Emergency';

export type TripStatus = 'active' | 'completed' | 'cancelled';

export type EmergencyStatus = 'active' | 'acknowledged' | 'resolved';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  driverId?: string;
  assignedBusId?: string | null;
  licenseNumber?: string;
  createdAt?: string;
}

export interface Bus {
  id: string;
  busNumber: string;
  registrationNumber: string;
  capacity: number;
  status: BusStatus;
  createdAt?: string;
  currentTrip?: Trip | null;
  lastLocation?: LocationUpdate | null;
  passengerCount?: number;
  driverName?: string;
  routeName?: string;
  routeColor?: string;
}

export interface Driver {
  id: string;
  userId: string;
  licenseNumber: string;
  assignedBusId?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  busNumber?: string;
  createdAt?: string;
}

export interface RouteStop {
  id: string;
  routeId: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
  etaMinutes?: number;
  distanceMeters?: number;
}

export interface CampusRoute {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  color: string;
  stops?: RouteStop[];
  createdAt?: string;
}

export interface Trip {
  id: string;
  busId: string;
  driverId: string;
  routeId: string;
  startTime: string;
  endTime?: string | null;
  status: TripStatus;
  busNumber?: string;
  driverName?: string;
  routeName?: string;
  passengerCount?: number;
}

export interface LocationUpdate {
  id?: string;
  tripId: string;
  busId: string;
  driverId?: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  heading?: number | null;
  timestamp: string;
  syncedAt?: string;
}

export interface OccupancyRecord {
  id?: string;
  tripId: string;
  passengerCount: number;
  timestamp: string;
}

export interface EmergencyAlert {
  id: string;
  tripId: string;
  busId: string;
  driverId: string;
  message: string;
  latitude: number;
  longitude: number;
  status: EmergencyStatus;
  createdAt: string;
  resolvedAt?: string | null;
  busNumber?: string;
  driverName?: string;
  routeName?: string;
}

export interface CampusNotification {
  id: string;
  userId?: string | null;
  role?: string | null;
  type: 'approaching' | 'delay' | 'emergency' | 'trip' | 'info';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface StopETA {
  stopId: string;
  stopName: string;
  sequence: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  distanceMeters: number;
  etaMinutes: number;
  isNextStop: boolean;
}

export interface LiveBusTrackingState {
  busId: string;
  busNumber: string;
  routeId: string;
  routeName: string;
  routeColor: string;
  driverId: string;
  driverName: string;
  tripId: string;
  status: BusStatus;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  passengerCount: number;
  capacity: number;
  lastUpdated: string;
  upcomingStops: StopETA[];
  nextStop?: StopETA;
  isEmergency: boolean;
}

export interface AnalyticsSummary {
  totalBuses: number;
  activeBuses: number;
  activeTrips: number;
  delayedBuses: number;
  activeEmergencies: number;
  totalRoutes: number;
  totalDrivers: number;
  totalStudents: number;
  averageOccupancyRate: number;
  tripsToday: number;
  recentEmergencies: EmergencyAlert[];
}
