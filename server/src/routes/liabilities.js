import { Router } from 'express';
import { body } from 'express-validator';
import {
  getLiabilities,
  getLiabilityById,
  createLiabilityPayment
} from '../controllers/liabilityController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

// Apply auth middleware to all liability routes
router.use(verifyToken);
router.use(authorize('ADMIN', 'MANAGER'));

// GET /api/liabilities
router.get('/', getLiabilities);

// GET /api/liabilities/:id
router.get('/:id', getLiabilityById);

// POST /api/liabilities/:id/payments
router.post(
  '/:id/payments',
  validate([
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Payment amount must be greater than 0.'),
    body('paymentMethod')
      .trim()
      .notEmpty()
      .isIn(['CASH', 'BANK'])
      .withMessage('Payment method must be CASH or BANK.'),
    body('description')
      .optional()
      .trim(),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format.')
  ]),
  createLiabilityPayment
);

export default router;
