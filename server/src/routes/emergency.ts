import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';
import type { EmergencyAlert } from '../types.js';

const router = Router();

// GET /api/emergency (List all emergency alerts)
router.get('/', authenticate, (req, res) => {
  try {
    const alerts = dbHelper.all<EmergencyAlert>(`
      SELECT 
        e.id,
        e.trip_id as tripId,
        e.bus_id as busId,
        e.driver_id as driverId,
        e.message,
        e.latitude,
        e.longitude,
        e.status,
        e.created_at as createdAt,
        e.resolved_at as resolvedAt,
        b.bus_number as busNumber,
        u.name as driverName,
        r.name as routeName
      FROM emergency_alerts e
      JOIN buses b ON b.id = e.bus_id
      JOIN drivers d ON d.id = e.driver_id
      JOIN users u ON u.id = d.user_id
      JOIN trips t ON t.id = e.trip_id
      JOIN routes r ON r.id = t.route_id
      ORDER BY e.created_at DESC
    `);

    return res.json({ success: true, data: alerts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch emergency alerts' });
  }
});

// POST /api/emergency (Trigger an emergency alert)
router.post('/', authenticate, requireRole(['driver', 'admin']), (req: AuthenticatedRequest, res) => {
  try {
    const { tripId, busId, driverId, message = 'Immediate assistance required!', latitude, longitude } = req.body;

    if (!tripId || !busId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'tripId, busId, latitude, and longitude are required' });
    }

    const alertId = `emg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    let resolvedDriverId = driverId;
    if (!resolvedDriverId && req.user?.role === 'driver') {
      const drv = dbHelper.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id]);
      if (drv) resolvedDriverId = drv.id;
    }

    // Default driver if not specified
    if (!resolvedDriverId) {
      const trip = dbHelper.get('SELECT driver_id FROM trips WHERE id = ?', [tripId]);
      resolvedDriverId = trip?.driver_id || 'drv-1';
    }

    // Insert alert
    dbHelper.run(`
      INSERT INTO emergency_alerts (id, trip_id, bus_id, driver_id, message, latitude, longitude, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [alertId, tripId, busId, resolvedDriverId, message.trim(), latitude, longitude, now]);

    // Mark bus status as EMERGENCY
    dbHelper.run(`UPDATE buses SET status = 'Emergency' WHERE id = ?`, [busId]);

    // Fetch details
    const alertData = dbHelper.get(`
      SELECT 
        e.id, e.trip_id as tripId, e.bus_id as busId, e.driver_id as driverId,
        e.message, e.latitude, e.longitude, e.status, e.created_at as createdAt,
        b.bus_number as busNumber,
        u.name as driverName,
        r.name as routeName
      FROM emergency_alerts e
      JOIN buses b ON b.id = e.bus_id
      JOIN drivers d ON d.id = e.driver_id
      JOIN users u ON u.id = d.user_id
      JOIN trips t ON t.id = e.trip_id
      JOIN routes r ON r.id = t.route_id
      WHERE e.id = ?
    `, [alertId]);

    // Broadcast emergency events
    socketEvents.emitEmergencyCreated(alertData);
    socketEvents.emitBusStatusChanged(busId, 'Emergency', { alertId, message });

    // Insert system notification
    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    dbHelper.run(`
      INSERT INTO notifications (id, role, type, title, message, read)
      VALUES (?, 'admin', 'emergency', ?, ?, 0)
    `, [notifId, `🚨 EMERGENCY: ${alertData.busNumber}`, `${alertData.driverName} reported: ${message}`]);

    return res.status(201).json({ success: true, data: alertData });
  } catch (err: any) {
    console.error('Trigger emergency error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record emergency' });
  }
});

// PUT /api/emergency/:id/acknowledge (Admin acknowledges)
router.put('/:id/acknowledge', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const alertId = req.params.id;
    const alert = dbHelper.get('SELECT * FROM emergency_alerts WHERE id = ?', [alertId]);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Emergency alert not found' });
    }

    dbHelper.run(`UPDATE emergency_alerts SET status = 'acknowledged' WHERE id = ?`, [alertId]);

    return res.json({ success: true, message: 'Emergency alert acknowledged' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to acknowledge alert' });
  }
});

// PUT /api/emergency/:id/resolve (Admin resolves emergency)
router.put('/:id/resolve', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const alertId = req.params.id;
    const alert = dbHelper.get('SELECT * FROM emergency_alerts WHERE id = ?', [alertId]);

    if (!alert) {
      return res.status(404).json({ success: false, message: 'Emergency alert not found' });
    }

    const now = new Date().toISOString();
    dbHelper.run(`
      UPDATE emergency_alerts
      SET status = 'resolved', resolved_at = ?
      WHERE id = ?
    `, [now, alertId]);

    // Restore bus status to On Time if trip is still active
    const trip = dbHelper.get('SELECT status FROM trips WHERE id = ?', [alert.trip_id]);
    const restoredStatus = trip && trip.status === 'active' ? 'On Time' : 'Completed';

    dbHelper.run(`UPDATE buses SET status = ? WHERE id = ?`, [restoredStatus, alert.bus_id]);

    socketEvents.emitEmergencyResolved(alertId, alert.bus_id);
    socketEvents.emitBusStatusChanged(alert.bus_id, restoredStatus);

    return res.json({ success: true, message: 'Emergency alert marked as resolved' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to resolve alert' });
  }
});

export default router;
