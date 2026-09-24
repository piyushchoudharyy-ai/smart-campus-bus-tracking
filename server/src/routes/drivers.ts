import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/drivers
router.get('/', (_req, res) => {
  try {
    const drivers = dbHelper.all(`
      SELECT 
        d.id,
        d.user_id as userId,
        d.license_number as licenseNumber,
        d.assigned_bus_id as assignedBusId,
        d.created_at as createdAt,
        u.name,
        u.email,
        u.phone,
        b.bus_number as busNumber,
        b.registration_number as registrationNumber
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN buses b ON b.id = d.assigned_bus_id
      ORDER BY u.name ASC
    `);

    return res.json({ success: true, data: drivers });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch drivers' });
  }
});

// GET /api/drivers/:id
router.get('/:id', (req, res) => {
  try {
    const driver = dbHelper.get(`
      SELECT 
        d.id,
        d.user_id as userId,
        d.license_number as licenseNumber,
        d.assigned_bus_id as assignedBusId,
        u.name,
        u.email,
        u.phone,
        b.bus_number as busNumber
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN buses b ON b.id = d.assigned_bus_id
      WHERE d.id = ?
    `, [req.params.id]);

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    return res.json({ success: true, data: driver });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch driver' });
  }
});

// POST /api/drivers (Admin only)
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { name, email, password, phone, licenseNumber, assignedBusId } = req.body;

    if (!name || !email || !password || !licenseNumber) {
      return res.status(400).json({ success: false, message: 'Name, email, password, and license number are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = dbHelper.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userId = `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const driverId = `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    dbHelper.run(`
      INSERT INTO users (id, name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?, 'driver')
    `, [userId, name.trim(), normalizedEmail, phone || null, passwordHash]);

    dbHelper.run(`
      INSERT INTO drivers (id, user_id, license_number, assigned_bus_id)
      VALUES (?, ?, ?, ?)
    `, [driverId, userId, licenseNumber.trim(), assignedBusId || null]);

    const created = dbHelper.get(`
      SELECT d.*, u.name, u.email, u.phone
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
    `, [driverId]);

    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to create driver' });
  }
});

// PUT /api/drivers/:id (Admin only)
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const { licenseNumber, assignedBusId, name, phone } = req.body;
    const driverId = req.params.id;

    const driver = dbHelper.get('SELECT * FROM drivers WHERE id = ?', [driverId]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    if (licenseNumber !== undefined || assignedBusId !== undefined) {
      dbHelper.run(`
        UPDATE drivers
        SET license_number = COALESCE(?, license_number),
            assigned_bus_id = ?
        WHERE id = ?
      `, [licenseNumber, assignedBusId !== undefined ? assignedBusId : driver.assigned_bus_id, driverId]);
    }

    if (name || phone !== undefined) {
      dbHelper.run(`
        UPDATE users
        SET name = COALESCE(?, name),
            phone = COALESCE(?, phone)
        WHERE id = ?
      `, [name, phone, driver.user_id]);
    }

    const updated = dbHelper.get(`
      SELECT d.*, u.name, u.email, u.phone, b.bus_number as busNumber
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN buses b ON b.id = d.assigned_bus_id
      WHERE d.id = ?
    `, [driverId]);

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to update driver' });
  }
});

// DELETE /api/drivers/:id (Admin only)
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const driver = dbHelper.get('SELECT user_id FROM drivers WHERE id = ?', [req.params.id]);
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    // Cascade delete user removes driver
    dbHelper.run('DELETE FROM users WHERE id = ?', [driver.user_id]);
    return res.json({ success: true, message: 'Driver deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete driver' });
  }
});

export default router;
