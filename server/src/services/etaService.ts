import { dbHelper } from '../db/index.js';
import {
  calculateDistanceKm,
  calculateDistanceMeters,
  calculateEtaMinutes,
  isApproachingStop
} from '../utils/haversine.js';
import { socketEvents } from './socketService.js';
import type { StopETA, LiveBusTrackingState } from '../types.js';

// Cache to prevent spamming approaching stop notifications
const approachingNotificationCache = new Map<string, number>();

export class ETAService {
  /**
   * Calculates ETAs for all stops on a bus's current active route
   */
  public static calculateRouteETAs(
    busId: string,
    currentLat: number,
    currentLng: number,
    currentSpeed: number | null = null
  ): { upcomingStops: StopETA[]; nextStop?: StopETA } {
    // Find active trip for bus
    const trip = dbHelper.get(`
      SELECT t.id as tripId, t.route_id as routeId, b.bus_number as busNumber
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      WHERE t.bus_id = ? AND t.status = 'active'
      ORDER BY t.start_time DESC
      LIMIT 1
    `, [busId]);

    if (!trip) {
      return { upcomingStops: [] };
    }

    // Get all stops for route ordered by sequence
    const stops = dbHelper.all(`
      SELECT id, name, latitude, longitude, sequence
      FROM stops
      WHERE route_id = ?
      ORDER BY sequence ASC
    `, [trip.routeId]);

    if (!stops.length) {
      return { upcomingStops: [] };
    }

    // Calculate distance to each stop
    const stopsWithDistances = stops.map((stop) => {
      const distMeters = calculateDistanceMeters(currentLat, currentLng, stop.latitude, stop.longitude);
      const distKm = distMeters / 1000;
      return {
        ...stop,
        distanceMeters: Math.round(distMeters),
        distanceKm: parseFloat(distKm.toFixed(2))
      };
    });

    // Determine the closest stop to figure out sequence progress
    let closestIndex = 0;
    let minDistance = stopsWithDistances[0].distanceMeters;

    for (let i = 1; i < stopsWithDistances.length; i++) {
      if (stopsWithDistances[i].distanceMeters < minDistance) {
        minDistance = stopsWithDistances[i].distanceMeters;
        closestIndex = i;
      }
    }

    // If within 50 meters of the stop, consider it at stop and next stop is i+1 (or wrap around if circular)
    let nextStopIndex = closestIndex;
    if (minDistance < 60 && closestIndex < stopsWithDistances.length - 1) {
      nextStopIndex = closestIndex + 1;
    }

    const upcomingStops: StopETA[] = [];

    // Calculate ETA for stops from nextStopIndex onward
    for (let i = nextStopIndex; i < stopsWithDistances.length; i++) {
      const stop = stopsWithDistances[i];
      const stopsBetween = i - nextStopIndex;
      const etaMin = calculateEtaMinutes(stop.distanceKm, currentSpeed, stopsBetween);

      upcomingStops.push({
        stopId: stop.id,
        stopName: stop.name,
        sequence: stop.sequence,
        latitude: stop.latitude,
        longitude: stop.longitude,
        distanceKm: stop.distanceKm,
        distanceMeters: stop.distanceMeters,
        etaMinutes: etaMin,
        isNextStop: i === nextStopIndex
      });
    }

    const nextStop = upcomingStops[0];

    // Check for approaching stop notification (< 350 meters)
    if (nextStop && nextStop.distanceMeters <= 350) {
      const cacheKey = `${busId}:${nextStop.stopId}`;
      const lastNotified = approachingNotificationCache.get(cacheKey) || 0;
      const now = Date.now();

      // Only notify once every 4 minutes per stop
      if (now - lastNotified > 240000) {
        approachingNotificationCache.set(cacheKey, now);

        const notifTitle = `🚌 Bus Approaching ${nextStop.stopName}`;
        const notifMsg = `${trip.busNumber} is approx ${nextStop.distanceMeters}m away (~${nextStop.etaMinutes} min).`;

        // Save notification to database
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        dbHelper.run(`
          INSERT INTO notifications (id, role, type, title, message, read)
          VALUES (?, 'student', 'approaching', ?, ?, 0)
        `, [notifId, notifTitle, notifMsg]);

        socketEvents.emitNotification({
          id: notifId,
          role: 'student',
          type: 'approaching',
          title: notifTitle,
          message: notifMsg,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    return { upcomingStops, nextStop };
  }

  /**
   * Returns live tracking data for all currently active buses
   */
  public static getActiveBusesTracking(): LiveBusTrackingState[] {
    const activeTrips = dbHelper.all(`
      SELECT 
        t.id as tripId,
        t.bus_id as busId,
        b.bus_number as busNumber,
        b.capacity as capacity,
        b.status as busStatus,
        r.id as routeId,
        r.name as routeName,
        r.color as routeColor,
        d.id as driverId,
        u.name as driverName
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      WHERE t.status = 'active'
    `);

    const result: LiveBusTrackingState[] = [];

    for (const trip of activeTrips) {
      // Get latest location for this bus / trip
      const lastLoc = dbHelper.get(`
        SELECT latitude, longitude, speed, accuracy, heading, timestamp
        FROM location_updates
        WHERE trip_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `, [trip.tripId]);

      // Get latest occupancy
      const lastOcc = dbHelper.get(`
        SELECT passenger_count as passengerCount
        FROM occupancy
        WHERE trip_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `, [trip.tripId]);

      // Check if there is an active emergency
      const activeEmergency = dbHelper.get(`
        SELECT id FROM emergency_alerts
        WHERE trip_id = ? AND status IN ('active', 'acknowledged')
        LIMIT 1
      `, [trip.tripId]);

      const lat = lastLoc?.latitude ?? 12.9352;
      const lng = lastLoc?.longitude ?? 77.6050;
      const speed = lastLoc?.speed ?? 0;
      const accuracy = lastLoc?.accuracy ?? 5;
      const passengerCount = lastOcc?.passengerCount ?? 0;

      const { upcomingStops, nextStop } = this.calculateRouteETAs(trip.busId, lat, lng, speed);

      result.push({
        busId: trip.busId,
        busNumber: trip.busNumber,
        routeId: trip.routeId,
        routeName: trip.routeName,
        routeColor: trip.routeColor,
        driverId: trip.driverId,
        driverName: trip.driverName,
        tripId: trip.tripId,
        status: activeEmergency ? 'Emergency' : trip.busStatus,
        latitude: lat,
        longitude: lng,
        speed: speed,
        accuracy: accuracy,
        passengerCount: passengerCount,
        capacity: trip.capacity,
        lastUpdated: lastLoc?.timestamp || new Date().toISOString(),
        upcomingStops,
        nextStop,
        isEmergency: Boolean(activeEmergency)
      });
    }

    return result;
  }
}
