import { Router } from 'express';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import { socketEvents } from '../services/socketService.js';
import type { CampusNotification } from '../types.js';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user?.role || 'student';
    const userId = req.user?.id;

    const notifications = dbHelper.all<CampusNotification>(`
      SELECT 
        id, user_id as userId, role, type, title, message, read, created_at as createdAt
      FROM notifications
      WHERE user_id = ? OR role = ? OR role IS NULL
      ORDER BY created_at DESC
      LIMIT 40
    `, [userId, userRole]);

    // Format boolean
    const formatted = notifications.map(n => ({
      ...n,
      read: Boolean(n.read)
    }));

    return res.json({ success: true, data: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, (req, res) => {
  try {
    dbHelper.run('UPDATE notifications SET read = 1 WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Marked as read' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userRole = req.user?.role || 'student';
    const userId = req.user?.id;

    dbHelper.run(`
      UPDATE notifications
      SET read = 1
      WHERE user_id = ? OR role = ? OR role IS NULL
    `, [userId, userRole]);

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
});

// POST /api/notifications/broadcast (Admin only)
router.post('/broadcast', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { title, message, role = 'student', type = 'info' } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message required' });
    }

    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    dbHelper.run(`
      INSERT INTO notifications (id, role, type, title, message, read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `, [id, role, type, title.trim(), message.trim(), now]);

    const notifObj = {
      id,
      role,
      type,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: now
    };

    socketEvents.emitNotification(notifObj);

    return res.status(201).json({ success: true, data: notifObj });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to broadcast notification' });
  }
});

export default router;
