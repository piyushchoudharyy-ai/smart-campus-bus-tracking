import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import type { AnalyticsSummary } from '../types.js';

const router = Router();

// GET /api/analytics (Admin operational metrics)
router.get('/', authenticate, requireRole(['admin']), (_req, res) => {
  try {
    const totalBuses = dbHelper.get('SELECT COUNT(*) as count FROM buses')?.count || 0;
    const activeTrips = dbHelper.get("SELECT COUNT(*) as count FROM trips WHERE status = 'active'")?.count || 0;
    const delayedBuses = dbHelper.get("SELECT COUNT(*) as count FROM buses WHERE status = 'Delayed'")?.count || 0;
    const activeEmergencies = dbHelper.get("SELECT COUNT(*) as count FROM emergency_alerts WHERE status IN ('active', 'acknowledged')")?.count || 0;
    const totalRoutes = dbHelper.get('SELECT COUNT(*) as count FROM routes')?.count || 0;
    const totalDrivers = dbHelper.get('SELECT COUNT(*) as count FROM drivers')?.count || 0;
    const totalStudents = dbHelper.get("SELECT COUNT(*) as count FROM users WHERE role = 'student'")?.count || 0;

    // Calculate active buses: buses with an active trip
    const activeBuses = dbHelper.get(`
      SELECT COUNT(DISTINCT bus_id) as count FROM trips WHERE status = 'active'
    `)?.count || 0;

    // Trips today
    const tripsToday = dbHelper.get(`
      SELECT COUNT(*) as count FROM trips
      WHERE date(start_time) = date('now')
    `)?.count || 0;

    // Average occupancy rate for active trips
    const activeTripOccupancy = dbHelper.all(`
      SELECT o.passenger_count, b.capacity
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN occupancy o ON o.trip_id = t.id
      WHERE t.status = 'active'
      GROUP BY t.id
      HAVING o.timestamp = MAX(o.timestamp)
    `);

    let avgOccupancyRate = 0;
    if (activeTripOccupancy.length > 0) {
      const sumRates = activeTripOccupancy.reduce((acc, item) => {
        const rate = (item.passenger_count / (item.capacity || 40)) * 100;
        return acc + rate;
      }, 0);
      avgOccupancyRate = Math.round(sumRates / activeTripOccupancy.length);
    }

    // Recent emergencies
    const recentEmergencies = dbHelper.all(`
      SELECT e.*, b.bus_number as busNumber, u.name as driverName, r.name as routeName
      FROM emergency_alerts e
      JOIN buses b ON b.id = e.bus_id
      JOIN drivers d ON d.id = e.driver_id
      JOIN users u ON u.id = d.user_id
      JOIN trips t ON t.id = e.trip_id
      JOIN routes r ON r.id = t.route_id
      ORDER BY e.created_at DESC
      LIMIT 5
    `);

    const summary: AnalyticsSummary = {
      totalBuses,
      activeBuses,
      activeTrips,
      delayedBuses,
      activeEmergencies,
      totalRoutes,
      totalDrivers,
      totalStudents,
      averageOccupancyRate: avgOccupancyRate,
      tripsToday,
      recentEmergencies
    };

    return res.json({ success: true, data: summary });
  } catch (err: any) {
    console.error('Analytics fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

export default router;
