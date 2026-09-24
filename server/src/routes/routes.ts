import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import type { CampusRoute, RouteStop } from '../types.js';

const router = Router();

// GET /api/routes
router.get('/', (_req, res) => {
  try {
    const routes = dbHelper.all<CampusRoute>(`
      SELECT id, name, description, status, color, created_at as createdAt
      FROM routes
      ORDER BY name ASC
    `);

    // Fetch stops for each route
    const enrichedRoutes = routes.map((route) => {
      const stops = dbHelper.all<RouteStop>(`
        SELECT id, route_id as routeId, name, latitude, longitude, sequence
        FROM stops
        WHERE route_id = ?
        ORDER BY sequence ASC
      `, [route.id]);

      return {
        ...route,
        stops
      };
    });

    return res.json({ success: true, data: enrichedRoutes });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch routes' });
  }
});

// GET /api/routes/:id
router.get('/:id', (req, res) => {
  try {
    const route = dbHelper.get<CampusRoute>(`
      SELECT id, name, description, status, color, created_at as createdAt
      FROM routes
      WHERE id = ?
    `, [req.params.id]);

    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const stops = dbHelper.all<RouteStop>(`
      SELECT id, route_id as routeId, name, latitude, longitude, sequence
      FROM stops
      WHERE route_id = ?
      ORDER BY sequence ASC
    `, [route.id]);

    return res.json({ success: true, data: { ...route, stops } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch route' });
  }
});

// POST /api/routes (Admin only)
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { name, description = '', status = 'active', color = '#2563EB', stops = [] } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Route name is required' });
    }

    const routeId = `route-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    dbHelper.run(`
      INSERT INTO routes (id, name, description, status, color)
      VALUES (?, ?, ?, ?, ?)
    `, [routeId, name.trim(), description.trim(), status, color]);

    // Insert stops if provided
    if (Array.isArray(stops) && stops.length > 0) {
      const insertStop = dbHelper.run;
      stops.forEach((stop: any, index: number) => {
        const stopId = `stop-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`;
        dbHelper.run(`
          INSERT INTO stops (id, route_id, name, latitude, longitude, sequence)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [stopId, routeId, stop.name, stop.latitude, stop.longitude, stop.sequence || index + 1]);
      });
    }

    const createdStops = dbHelper.all(`
      SELECT id, route_id as routeId, name, latitude, longitude, sequence
      FROM stops
      WHERE route_id = ?
      ORDER BY sequence ASC
    `, [routeId]);

    const createdRoute = dbHelper.get('SELECT * FROM routes WHERE id = ?', [routeId]);

    return res.status(201).json({
      success: true,
      data: {
        ...createdRoute,
        stops: createdStops
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to create route' });
  }
});

// PUT /api/routes/:id (Admin only)
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { name, description, status, color } = req.body;
    const routeId = req.params.id;

    const existing = dbHelper.get('SELECT id FROM routes WHERE id = ?', [routeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    dbHelper.run(`
      UPDATE routes
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          color = COALESCE(?, color)
      WHERE id = ?
    `, [name, description, status, color, routeId]);

    const updated = dbHelper.get('SELECT * FROM routes WHERE id = ?', [routeId]);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update route' });
  }
});

// DELETE /api/routes/:id (Admin only)
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const routeId = req.params.id;
    const existing = dbHelper.get('SELECT id FROM routes WHERE id = ?', [routeId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    dbHelper.run('DELETE FROM routes WHERE id = ?', [routeId]);
    return res.json({ success: true, message: 'Route deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete route' });
  }
});

export default router;
