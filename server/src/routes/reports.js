import { Router } from 'express';
import {
  getDashboard,
  getDailySales,
  getMonthlySales,
  getProfitReport,
  getStockValue,
} from '../controllers/reportController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';

const router = Router();

router.use(verifyToken);
router.use(authorize('ADMIN', 'MANAGER'));

// GET /api/reports/dashboard
router.get('/dashboard', getDashboard);

// GET /api/reports/daily-sales
router.get('/daily-sales', getDailySales);

// GET /api/reports/monthly-sales
router.get('/monthly-sales', getMonthlySales);

// GET /api/reports/profit
router.get('/profit', getProfitReport);

// GET /api/reports/stock-value
router.get('/stock-value', getStockValue);

export default router;
