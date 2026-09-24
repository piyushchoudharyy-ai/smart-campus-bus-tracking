import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';

const router = Router();

// POST /api/occupancy (Update passenger count)
router.post('/', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { tripId, passengerCount } = req.body;

    if (!tripId || passengerCount === undefined || passengerCount < 0) {
      return res.status(400).json({ success: false, message: 'Valid tripId and passengerCount required' });
    }

    const trip = dbHelper.get(`
      SELECT t.id, t.bus_id as busId, b.capacity
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      WHERE t.id = ?
    `, [tripId]);

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const id = `occ-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    dbHelper.run(`
      INSERT INTO occupancy (id, trip_id, passenger_count, timestamp)
      VALUES (?, ?, ?, ?)
    `, [id, tripId, passengerCount, now]);

    // Broadcast occupancy update
    socketEvents.emitOccupancyUpdated(tripId, trip.busId, passengerCount, trip.capacity);

    return res.json({
      success: true,
      message: 'Occupancy updated',
      data: {
        tripId,
        busId: trip.busId,
        passengerCount,
        capacity: trip.capacity,
        timestamp: now
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update occupancy' });
  }
});

// GET /api/occupancy/:tripId
router.get('/:tripId', (req, res) => {
  try {
    const history = dbHelper.all(`
      SELECT id, trip_id as tripId, passenger_count as passengerCount, timestamp
      FROM occupancy
      WHERE trip_id = ?
      ORDER BY timestamp DESC
      LIMIT 20
    `, [req.params.tripId]);

    return res.json({ success: true, data: history });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch occupancy records' });
  }
});

export default router;
