import { Router } from 'express';
import { simulationService } from '../services/simulationService.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/simulation/status
router.get('/status', (_req, res) => {
  return res.json({
    success: true,
    data: {
      isSimulating: simulationService.isSimulating()
    }
  });
});

// POST /api/simulation/start (Admin only)
router.post('/start', authenticate, requireRole(['admin']), (req, res) => {
  const { speedMultiplier = 1.0 } = req.body;
  simulationService.startSimulation(speedMultiplier);
  return res.json({
    success: true,
    message: 'GPS simulation started',
    data: { isSimulating: true }
  });
});

// POST /api/simulation/stop (Admin only)
router.post('/stop', authenticate, requireRole(['admin']), (_req, res) => {
  simulationService.stopSimulation();
  return res.json({
    success: true,
    message: 'GPS simulation stopped',
    data: { isSimulating: false }
  });
});

export default router;
