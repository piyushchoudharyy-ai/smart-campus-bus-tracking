import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { dbHelper } from '../db/index.js';
import { generateToken } from '../utils/jwt.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '../types.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, phone, role = 'student', licenseNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing
    const existing = dbHelper.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    const userId = `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    const validRole: UserRole = ['student', 'driver', 'admin'].includes(role) ? role : 'student';

    dbHelper.run(`
      INSERT INTO users (id, name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, name.trim(), normalizedEmail, phone || null, passwordHash, validRole]);

    let driverId: string | undefined;
    if (validRole === 'driver') {
      driverId = `drv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      dbHelper.run(`
        INSERT INTO drivers (id, user_id, license_number)
        VALUES (?, ?, ?)
      `, [driverId, userId, licenseNumber || 'DL-PENDING']);
    }

    const token = generateToken({
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      role: validRole,
      driverId
    });

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        role: validRole,
        phone,
        driverId
      }
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = dbHelper.get(`
      SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role,
             d.id as driver_id, d.assigned_bus_id
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      WHERE u.email = ?
    `, [normalizedEmail]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      driverId: user.driver_id,
      assignedBusId: user.assigned_bus_id
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        driverId: user.driver_id,
        assignedBusId: user.assigned_bus_id
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const user = dbHelper.get(`
      SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
             d.id as driver_id, d.assigned_bus_id, d.license_number,
             b.bus_number, b.capacity as bus_capacity
      FROM users u
      LEFT JOIN drivers d ON d.user_id = u.id
      LEFT JOIN buses b ON b.id = d.assigned_bus_id
      WHERE u.id = ?
    `, [req.user!.id]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        driverId: user.driver_id,
        assignedBusId: user.assigned_bus_id,
        licenseNumber: user.license_number,
        busNumber: user.bus_number,
        createdAt: user.created_at
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Server error fetching user' });
  }
});

export default router;
