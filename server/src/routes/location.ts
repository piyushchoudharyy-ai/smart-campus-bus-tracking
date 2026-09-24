import { Router } from 'express';
import { dbHelper, db } from '../db/index.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';
import { ETAService } from '../services/etaService.js';
import { calculateDistanceMeters, calculateBearing } from '../utils/haversine.js';
import type { LocationUpdate } from '../types.js';

const router = Router();

/**
 * Helper to process a single location fix
 */
function processLocationRecord(data: LocationUpdate, isBatchItem: boolean = false) {
  const {
    tripId,
    busId,
    latitude,
    longitude,
    speed = null,
    accuracy = null,
    heading = null,
    timestamp = new Date().toISOString()
  } = data;

  if (!tripId || !busId || latitude === undefined || longitude === undefined) {
    return { error: 'Missing required location fields' };
  }

  // Deduplication check
  const existing = dbHelper.get(`
    SELECT id FROM location_updates
    WHERE trip_id = ? AND timestamp = ?
  `, [tripId, timestamp]);

  if (existing) {
    return { skipped: true, id: existing.id };
  }

  // Check last point for network/battery optimization (don't write duplicate stationary points < 5m)
  const lastPoint = dbHelper.get(`
    SELECT latitude, longitude, timestamp FROM location_updates
    WHERE trip_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `, [tripId]);

  let finalHeading = heading;
  if (lastPoint) {
    const movedMeters = calculateDistanceMeters(lastPoint.latitude, lastPoint.longitude, latitude, longitude);
    if (!finalHeading && movedMeters > 3) {
      finalHeading = calculateBearing(lastPoint.latitude, lastPoint.longitude, latitude, longitude);
    }
    // If not moving (< 3 meters) and speed is 0 and recorded within last 10 seconds, skip duplicate
    const timeDiffMs = Math.abs(new Date(timestamp).getTime() - new Date(lastPoint.timestamp).getTime());
    if (movedMeters < 3 && (speed === 0 || speed === null) && timeDiffMs < 10000 && !isBatchItem) {
      return { skipped: true, reason: 'Stationary optimization' };
    }
  }

  const id = `loc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  dbHelper.run(`
    INSERT INTO location_updates (id, trip_id, bus_id, latitude, longitude, speed, accuracy, heading, timestamp, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [id, tripId, busId, latitude, longitude, speed, accuracy, finalHeading, timestamp]);

  return { id, heading: finalHeading };
}

// POST /api/location (Single real-time GPS update from driver's phone)
router.post('/', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const result = processLocationRecord(req.body);

    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const { busId, tripId, latitude, longitude, speed = 0, accuracy = 5, timestamp } = req.body;

    // Calculate real-time ETAs for this bus
    const { upcomingStops, nextStop } = ETAService.calculateRouteETAs(busId, latitude, longitude, speed);

    const payload = {
      id: result.id,
      busId,
      tripId,
      latitude,
      longitude,
      speed,
      accuracy,
      heading: result.heading,
      timestamp: timestamp || new Date().toISOString(),
      upcomingStops,
      nextStop
    };

    // Broadcast to students and admins
    socketEvents.emitLocationUpdate(payload);

    return res.status(200).json({
      success: true,
      message: 'Location recorded',
      data: payload
    });
  } catch (err: any) {
    console.error('Location update error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record location update' });
  }
});

// POST /api/location/batch (Offline synchronization endpoint)
router.post('/batch', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { updates } = req.body as { updates: LocationUpdate[] };

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of updates required' });
    }

    console.log(`Processing offline sync batch of ${updates.length} location records...`);

    let processedCount = 0;
    let skippedCount = 0;

    // Use transaction for speed and atomic batching
    db.exec('BEGIN TRANSACTION;');

    try {
      for (const update of updates) {
        const res = processLocationRecord(update, true);
        if (res.skipped) {
          skippedCount++;
        } else if (!res.error) {
          processedCount++;
        }
      }
      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    // Broadcast the very latest point from the batch to keep all live maps synchronized
    const latestUpdate = updates[updates.length - 1];
    if (latestUpdate && latestUpdate.busId && latestUpdate.latitude && latestUpdate.longitude) {
      const { upcomingStops, nextStop } = ETAService.calculateRouteETAs(
        latestUpdate.busId,
        latestUpdate.latitude,
        latestUpdate.longitude,
        latestUpdate.speed
      );

      socketEvents.emitLocationUpdate({
        busId: latestUpdate.busId,
        tripId: latestUpdate.tripId,
        latitude: latestUpdate.latitude,
        longitude: latestUpdate.longitude,
        speed: latestUpdate.speed,
        accuracy: latestUpdate.accuracy,
        heading: latestUpdate.heading,
        timestamp: latestUpdate.timestamp,
        syncedOfflineCount: processedCount,
        upcomingStops,
        nextStop
      });
    }

    return res.json({
      success: true,
      message: `Successfully synchronized ${processedCount} offline updates (${skippedCount} duplicates skipped)`,
      processedCount,
      skippedCount
    });
  } catch (err: any) {
    console.error('Batch location sync error:', err);
    return res.status(500).json({ success: false, message: 'Failed to synchronize offline batch' });
  }
});

// GET /api/location/bus/:id (Latest location & ETA for a specific bus)
router.get('/bus/:id', (req, res) => {
  try {
    const busId = req.params.id;
    const bus = dbHelper.get(`
      SELECT b.id, b.bus_number as busNumber, b.status, t.id as tripId, t.route_id as routeId
      FROM buses b
      LEFT JOIN trips t ON t.bus_id = b.id AND t.status = 'active'
      WHERE b.id = ?
    `, [busId]);

    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    if (!bus.tripId) {
      return res.json({
        success: true,
        data: {
          busId: bus.id,
          busNumber: bus.busNumber,
          status: bus.status,
          isTripActive: false,
          location: null,
          upcomingStops: []
        }
      });
    }

    const lastLoc = dbHelper.get(`
      SELECT latitude, longitude, speed, accuracy, heading, timestamp
      FROM location_updates
      WHERE trip_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [bus.tripId]);

    const { upcomingStops, nextStop } = lastLoc
      ? ETAService.calculateRouteETAs(bus.id, lastLoc.latitude, lastLoc.longitude, lastLoc.speed)
      : { upcomingStops: [], nextStop: undefined };

    return res.json({
      success: true,
      data: {
        busId: bus.id,
        busNumber: bus.busNumber,
        status: bus.status,
        tripId: bus.tripId,
        isTripActive: true,
        location: lastLoc || null,
        upcomingStops,
        nextStop
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch bus location' });
  }
});

export default router;
