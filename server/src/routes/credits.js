import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCreditSummary,
  getCustomerCredits,
  recordPayment,
  getOverdue,
} from '../controllers/creditController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(verifyToken);

// GET /api/credits/summary
router.get('/summary', authorize('ADMIN', 'MANAGER'), getCreditSummary);

// GET /api/credits/overdue
router.get('/overdue', authorize('ADMIN', 'MANAGER'), getOverdue);

// GET /api/credits/customer/:customerId
router.get('/customer/:customerId', authorize('ADMIN', 'MANAGER'), getCustomerCredits);

// POST /api/credits/payment
router.post(
  '/payment',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate([
    body('customerId').isInt({ min: 1 }).withMessage('Valid customer ID is required.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
    body('description').optional().trim(),
  ]),
  recordPayment
);

export default router;
