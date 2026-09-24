import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';
import type { Bus } from '../types.js';

const router = Router();

// GET /api/buses
router.get('/', (_req, res) => {
  try {
    const buses = dbHelper.all(`
      SELECT 
        b.id,
        b.bus_number as busNumber,
        b.registration_number as registrationNumber,
        b.capacity,
        b.status,
        b.created_at as createdAt,
        t.id as tripId,
        t.status as tripStatus,
        r.id as routeId,
        r.name as routeName,
        r.color as routeColor,
        u.name as driverName,
        d.id as driverId
      FROM buses b
      LEFT JOIN trips t ON t.bus_id = b.id AND t.status = 'active'
      LEFT JOIN routes r ON r.id = t.route_id
      LEFT JOIN drivers d ON d.id = t.driver_id
      LEFT JOIN users u ON u.id = d.user_id
      ORDER BY b.bus_number ASC
    `);

    // Attach latest location and occupancy to each bus
    const enrichedBuses = buses.map((bus) => {
      let lastLocation = null;
      let passengerCount = 0;

      if (bus.tripId) {
        lastLocation = dbHelper.get(`
          SELECT latitude, longitude, speed, accuracy, heading, timestamp
          FROM location_updates
          WHERE trip_id = ?
          ORDER BY timestamp DESC
          LIMIT 1
        `, [bus.tripId]) || null;

        const occ = dbHelper.get(`
          SELECT passenger_count as passengerCount
          FROM occupancy
          WHERE trip_id = ?
          ORDER BY timestamp DESC
          LIMIT 1
        `, [bus.tripId]);
        passengerCount = occ?.passengerCount ?? 0;
      }

      return {
        id: bus.id,
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        capacity: bus.capacity,
        status: bus.status,
        createdAt: bus.createdAt,
        driverName: bus.driverName,
        routeName: bus.routeName,
        routeColor: bus.routeColor,
        passengerCount,
        lastLocation,
        currentTrip: bus.tripId
          ? {
              id: bus.tripId,
              busId: bus.id,
              driverId: bus.driverId,
              routeId: bus.routeId,
              status: bus.tripStatus
            }
          : null
      };
    });

    return res.json({ success: true, data: enrichedBuses });
  } catch (err: any) {
    console.error('Fetch buses error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch buses' });
  }
});

// GET /api/buses/:id
router.get('/:id', (req, res) => {
  try {
    const bus = dbHelper.get(`
      SELECT 
        b.id,
        b.bus_number as busNumber,
        b.registration_number as registrationNumber,
        b.capacity,
        b.status,
        b.created_at as createdAt
      FROM buses b
      WHERE b.id = ?
    `, [req.params.id]);

    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    return res.json({ success: true, data: bus });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch bus' });
  }
});

// POST /api/buses (Admin only)
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { busNumber, registrationNumber, capacity = 40, status = 'Not Started' } = req.body;

    if (!busNumber || !registrationNumber) {
      return res.status(400).json({ success: false, message: 'Bus number and registration number required' });
    }

    const id = `bus-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    dbHelper.run(`
      INSERT INTO buses (id, bus_number, registration_number, capacity, status)
      VALUES (?, ?, ?, ?, ?)
    `, [id, busNumber.trim(), registrationNumber.trim().toUpperCase(), capacity, status]);

    const created = dbHelper.get('SELECT * FROM buses WHERE id = ?', [id]);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'Bus number or registration number already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create bus' });
  }
});

// PUT /api/buses/:id (Admin only)
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { busNumber, registrationNumber, capacity, status } = req.body;
    const busId = req.params.id;

    const existing = dbHelper.get('SELECT * FROM buses WHERE id = ?', [busId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    dbHelper.run(`
      UPDATE buses
      SET bus_number = COALESCE(?, bus_number),
          registration_number = COALESCE(?, registration_number),
          capacity = COALESCE(?, capacity),
          status = COALESCE(?, status)
      WHERE id = ?
    `, [busNumber, registrationNumber, capacity, status, busId]);

    if (status && status !== existing.status) {
      socketEvents.emitBusStatusChanged(busId, status);
    }

    const updated = dbHelper.get('SELECT * FROM buses WHERE id = ?', [busId]);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update bus' });
  }
});

// DELETE /api/buses/:id (Admin only)
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const busId = req.params.id;
    const existing = dbHelper.get('SELECT id FROM buses WHERE id = ?', [busId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    dbHelper.run('DELETE FROM buses WHERE id = ?', [busId]);
    return res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete bus' });
  }
});

export default router;
