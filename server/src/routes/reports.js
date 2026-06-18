import { Router } from 'express';
import {
  getDashboard,
  getDailySales,
  getMonthlySales,
  getProfitReport,
  getStockValue,
  getPurchaseLedger,
  getProductPurchaseDetail,
  getSalesLedger,
  getProductSalesDetail,
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

// GET /api/reports/purchase-ledger
router.get('/purchase-ledger', getPurchaseLedger);

// GET /api/reports/purchase-ledger/:productId
router.get('/purchase-ledger/:productId', getProductPurchaseDetail);

// GET /api/reports/sales-ledger
router.get('/sales-ledger', getSalesLedger);

// GET /api/reports/sales-ledger/:productId
router.get('/sales-ledger/:productId', getProductSalesDetail);

export default router;
