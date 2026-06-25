import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCashSummary,
  getCashLedger,
  getCashTransactions,
  createCashTransaction
} from '../controllers/cashController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

// Apply auth middleware to all cash routes
router.use(verifyToken);
router.use(authorize('ADMIN', 'MANAGER'));

// GET /api/cash/summary
router.get('/summary', getCashSummary);

// GET /api/cash/ledger
router.get('/ledger', getCashLedger);

// GET /api/cash/transactions
router.get('/transactions', getCashTransactions);

// POST /api/cash/transactions
router.post(
  '/transactions',
  validate([
    body('type')
      .trim()
      .notEmpty()
      .withMessage('Transaction type is required.')
      .isIn(['INFLOW', 'EXPENSE', 'BANK_TRANSFER', 'PARTY_PAYMENT', 'LIABILITY', 'GOODS_PURCHASE', 'TRANSPORT'])
      .withMessage('Invalid transaction type.'),
    body('paymentMethod')
      .optional()
      .trim()
      .isIn(['CASH', 'BANK'])
      .withMessage('Invalid payment method.'),
    body('amount')
      .optional() // amount is computed automatically for GOODS_PURCHASE (qty * unitPrice), but otherwise required
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be a positive number.'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Invalid date format.'),
    body('description')
      .optional()
      .trim(),
    body('partyName')
      .optional()
      .trim(),
    body('liabilityName')
      .optional()
      .trim(),
    body('remainingBalance')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Remaining balance must be a non-negative number.'),
    body('itemName')
      .optional()
      .trim(),
    body('quantity')
      .optional()
      .isFloat({ min: 0.001 })
      .withMessage('Quantity must be greater than 0.'),
    body('unitPrice')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Unit price must be greater than 0.')
  ]),
  createCashTransaction
);

export default router;
