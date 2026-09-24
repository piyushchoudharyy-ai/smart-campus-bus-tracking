import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';
import { ETAService } from '../services/etaService.js';

const router = Router();

// GET /api/trips/active
router.get('/active', (_req, res) => {
  try {
    const activeData = ETAService.getActiveBusesTracking();
    return res.json({ success: true, data: activeData });
  } catch (err: any) {
    console.error('Active trips error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch active trips' });
  }
});

// GET /api/trips/history
router.get('/history', (_req, res) => {
  try {
    const history = dbHelper.all(`
      SELECT 
        t.id,
        t.bus_id as busId,
        t.driver_id as driverId,
        t.route_id as routeId,
        t.start_time as startTime,
        t.end_time as endTime,
        t.status,
        b.bus_number as busNumber,
        r.name as routeName,
        r.color as routeColor,
        u.name as driverName,
        (SELECT COUNT(*) FROM location_updates WHERE trip_id = t.id) as totalGpsPings,
        (SELECT MAX(passenger_count) FROM occupancy WHERE trip_id = t.id) as peakOccupancy
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      ORDER BY t.start_time DESC
      LIMIT 50
    `);

    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch trip history' });
  }
});

// POST /api/trips/start
router.post('/start', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { busId, routeId, driverId: explicitDriverId } = req.body;

    // Resolve driver ID
    let driverId = explicitDriverId;
    if (!driverId && req.user?.role === 'driver') {
      const driver = dbHelper.get('SELECT id, assigned_bus_id FROM drivers WHERE user_id = ?', [req.user.id]);
      if (driver) {
        driverId = driver.id;
        if (!busId && driver.assigned_bus_id) {
          req.body.busId = driver.assigned_bus_id;
        }
      }
    }

    const finalBusId = busId || req.body.busId;

    if (!finalBusId || !routeId || !driverId) {
      return res.status(400).json({
        success: false,
        message: 'busId, routeId, and driverId are required to start a trip'
      });
    }

    // Check if bus already has an active trip
    const existingActiveTrip = dbHelper.get(`
      SELECT id FROM trips WHERE bus_id = ? AND status = 'active'
    `, [finalBusId]);

    if (existingActiveTrip) {
      return res.status(400).json({
        success: false,
        message: 'This bus already has an active trip underway',
        tripId: existingActiveTrip.id
      });
    }

    const tripId = `trip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    dbHelper.run(`
      INSERT INTO trips (id, bus_id, driver_id, route_id, start_time, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `, [tripId, finalBusId, driverId, routeId, now]);

    // Update bus status to On Time
    dbHelper.run(`
      UPDATE buses SET status = 'On Time' WHERE id = ?
    `, [finalBusId]);

    // Initial occupancy = 0
    const occId = `occ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    dbHelper.run(`
      INSERT INTO occupancy (id, trip_id, passenger_count, timestamp)
      VALUES (?, ?, 0, ?)
    `, [occId, tripId, now]);

    // Fetch trip details for broadcasting
    const tripDetails = dbHelper.get(`
      SELECT 
        t.id, t.bus_id as busId, t.driver_id as driverId, t.route_id as routeId,
        t.start_time as startTime, t.status,
        b.bus_number as busNumber, b.capacity,
        r.name as routeName, r.color as routeColor,
        u.name as driverName
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      WHERE t.id = ?
    `, [tripId]);

    // Broadcast trip started event
    socketEvents.emitTripStarted(tripDetails);
    socketEvents.emitBusStatusChanged(finalBusId, 'On Time');

    // Notify students
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const notifTitle = `🚌 ${tripDetails.busNumber} has departed`;
    const notifMsg = `Trip started on ${tripDetails.routeName}. Live GPS tracking active.`;

    dbHelper.run(`
      INSERT INTO notifications (id, role, type, title, message, read)
      VALUES (?, 'student', 'trip', ?, ?, 0)
    `, [notifId, notifTitle, notifMsg]);

    socketEvents.emitNotification({
      id: notifId,
      role: 'student',
      type: 'trip',
      title: notifTitle,
      message: notifMsg,
      read: false,
      createdAt: now
    });

    return res.status(201).json({ success: true, data: tripDetails });
  } catch (err: any) {
    console.error('Start trip error:', err);
    return res.status(500).json({ success: false, message: 'Failed to start trip' });
  }
});

// POST /api/trips/:id/end
router.post('/:id/end', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const tripId = req.params.id;

    const trip = dbHelper.get(`
      SELECT t.id, t.bus_id as busId, b.bus_number as busNumber, r.name as routeName
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      WHERE t.id = ? AND t.status = 'active'
    `, [tripId]);

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Active trip not found' });
    }

    const now = new Date().toISOString();

    dbHelper.run(`
      UPDATE trips
      SET status = 'completed', end_time = ?
      WHERE id = ?
    `, [now, tripId]);

    dbHelper.run(`
      UPDATE buses
      SET status = 'Completed'
      WHERE id = ?
    `, [trip.busId]);

    socketEvents.emitTripEnded(tripId, trip.busId);
    socketEvents.emitBusStatusChanged(trip.busId, 'Completed');

    // Student notification
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const notifTitle = `🏁 ${trip.busNumber} completed trip`;
    const notifMsg = `Trip on ${trip.routeName} has finished.`;

    dbHelper.run(`
      INSERT INTO notifications (id, role, type, title, message, read)
      VALUES (?, 'student', 'trip', ?, ?, 0)
    `, [notifId, notifTitle, notifMsg]);

    socketEvents.emitNotification({
      id: notifId,
      role: 'student',
      type: 'trip',
      title: notifTitle,
      message: notifMsg,
      read: false,
      createdAt: now
    });

    return res.json({ success: true, message: 'Trip completed successfully' });
  } catch (err: any) {
    console.error('End trip error:', err);
    return res.status(500).json({ success: false, message: 'Failed to end trip' });
  }
});

export default router;
