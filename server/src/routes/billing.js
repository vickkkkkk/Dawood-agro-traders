import { Router } from 'express';
import { body } from 'express-validator';
import {
  createBill,
  getBills,
  getBillById,
  getDailySales,
  voidBill,
  returnBillItem,
} from '../controllers/billingController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

// All billing routes require authentication
router.use(verifyToken);

// POST /api/billing/bills
router.post(
  '/bills',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate([
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one item is required.'),
    body('items.*.productId')
      .isInt({ min: 1 })
      .withMessage('Valid product ID is required for each item.'),
    body('items.*.quantity')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be greater than 0.'),
    body('paymentMethod')
      .isIn(['CASH', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'CREDIT'])
      .withMessage('Valid payment method is required.'),
    body('discount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Discount must be 0 or more.'),
    body('customerId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required.'),
    body('amountPaid')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Amount paid must be 0 or more.'),
  ]),
  createBill
);

// GET /api/bills
router.get('/bills', authorize('ADMIN', 'MANAGER', 'CASHIER'), getBills);

// GET /api/bills/daily-sales
router.get('/bills/daily-sales', authorize('ADMIN', 'MANAGER'), getDailySales);

// GET /api/bills/:id
router.get('/bills/:id', authorize('ADMIN', 'MANAGER', 'CASHIER'), getBillById);

// PUT /api/bills/:id/void - Admin only
router.put('/bills/:id/void', authorize('ADMIN'), voidBill);

// PUT /api/bills/:id/return-item
router.put(
  '/bills/:id/return-item', 
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('billItemId').isInt({ min: 1 }).withMessage('Valid bill item ID is required.'),
    body('quantity').isFloat({ min: 0.01 }).withMessage('Return quantity must be greater than 0.'),
  ]),
  returnBillItem
);

export default router;
