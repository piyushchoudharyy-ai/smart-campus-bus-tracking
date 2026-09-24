import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import type { RouteStop } from '../types.js';

const router = Router();

// GET /api/stops (optional filter by routeId)
router.get('/', (req, res) => {
  try {
    const { routeId } = req.query;

    let sql = `
      SELECT s.id, s.route_id as routeId, s.name, s.latitude, s.longitude, s.sequence,
             r.name as routeName, r.color as routeColor
      FROM stops s
      JOIN routes r ON r.id = s.route_id
    `;
    const params: any[] = [];

    if (routeId) {
      sql += ' WHERE s.route_id = ?';
      params.push(routeId);
    }

    sql += ' ORDER BY s.route_id, s.sequence ASC';

    const stops = dbHelper.all(sql, params);
    return res.json({ success: true, data: stops });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stops' });
  }
});

// POST /api/stops (Admin only)
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { routeId, name, latitude, longitude, sequence } = req.body;

    if (!routeId || !name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'routeId, name, latitude, and longitude are required' });
    }

    const route = dbHelper.get('SELECT id FROM routes WHERE id = ?', [routeId]);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found' });
    }

    const stopId = `stop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalSeq = sequence || 1;

    dbHelper.run(`
      INSERT INTO stops (id, route_id, name, latitude, longitude, sequence)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [stopId, routeId, name.trim(), latitude, longitude, finalSeq]);

    const created = dbHelper.get('SELECT * FROM stops WHERE id = ?', [stopId]);
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to create stop' });
  }
});

// PUT /api/stops/:id (Admin only)
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { name, latitude, longitude, sequence } = req.body;
    const stopId = req.params.id;

    const existing = dbHelper.get('SELECT id FROM stops WHERE id = ?', [stopId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Stop not found' });
    }

    dbHelper.run(`
      UPDATE stops
      SET name = COALESCE(?, name),
          latitude = COALESCE(?, latitude),
          longitude = COALESCE(?, longitude),
          sequence = COALESCE(?, sequence)
      WHERE id = ?
    `, [name, latitude, longitude, sequence, stopId]);

    const updated = dbHelper.get('SELECT * FROM stops WHERE id = ?', [stopId]);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update stop' });
  }
});

// DELETE /api/stops/:id (Admin only)
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const stopId = req.params.id;
    const existing = dbHelper.get('SELECT id FROM stops WHERE id = ?', [stopId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Stop not found' });
    }

    dbHelper.run('DELETE FROM stops WHERE id = ?', [stopId]);
    return res.json({ success: true, message: 'Stop deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete stop' });
  }
});

export default router;
