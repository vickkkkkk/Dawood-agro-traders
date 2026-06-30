import express from 'express';
import { body } from 'express-validator';
import validate from '../middleware/validate.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import {
  getReturnRecords,
  getReturnRecordById,
  createSaleReturn,
  createPurchaseReturn,
} from '../controllers/returnController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/returns
router.get('/', authorize('ADMIN', 'MANAGER'), getReturnRecords);

// GET /api/returns/:id
router.get('/:id', authorize('ADMIN', 'MANAGER'), getReturnRecordById);

// POST /api/returns/sales
router.post(
  '/sales',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  [
    body('billId').isInt().withMessage('Bill ID is required.'),
    body('refundMethod').isIn(['CASH', 'CREDIT', 'ONLINE', 'NONE']).withMessage('Invalid refund method.'),
    body('reason').isIn(['damaged', 'wrong item', 'customer cancelled', 'quality issue', 'other']).withMessage('Invalid reason.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item to return is required.'),
    body('items.*.billItemId').isInt().withMessage('Valid bill item ID is required for each item.'),
    body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Return quantity must be greater than 0.'),
  ],
  validate,
  createSaleReturn
);

// POST /api/returns/purchases
router.post(
  '/purchases',
  authorize('ADMIN', 'MANAGER'),
  [
    body('purchaseId').isInt().withMessage('Purchase ID is required.'),
    body('refundMethod').isIn(['CASH', 'CREDIT', 'ONLINE', 'NONE']).withMessage('Invalid refund method.'),
    body('reason').isIn(['damaged', 'wrong item', 'customer cancelled', 'quality issue', 'other']).withMessage('Invalid reason.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item to return is required.'),
    body('items.*.purchaseItemId').isInt().withMessage('Valid purchase item ID is required for each item.'),
    body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Return quantity must be greater than 0.'),
  ],
  validate,
  createPurchaseReturn
);

export default router;
