import { Router } from 'express';
import { body } from 'express-validator';
import {
  getPurchases,
  createPurchase,
  getPurchaseById,
  getSuppliers,
  createSupplier,
  updateSupplier,
} from '../controllers/purchaseController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(verifyToken);

// --- Supplier routes (must be before /:id to avoid conflict) ---

// GET /api/purchases/suppliers
router.get('/suppliers', authorize('ADMIN', 'MANAGER'), getSuppliers);

// POST /api/purchases/suppliers
router.post(
  '/suppliers',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').trim().notEmpty().withMessage('Supplier name is required.'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('company').optional().trim(),
  ]),
  createSupplier
);

// PUT /api/purchases/suppliers/:id
router.put(
  '/suppliers/:id',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty.'),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('company').optional().trim(),
  ]),
  updateSupplier
);

// --- Purchase routes ---

// GET /api/purchases
router.get('/purchases', authorize('ADMIN', 'MANAGER'), getPurchases);

// POST /api/purchases
router.post(
  '/purchases',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('supplierId').isInt({ min: 1 }).withMessage('Valid supplier ID is required.'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('At least one item is required.'),
    body('items.*.productId')
      .isInt({ min: 1 })
      .withMessage('Valid product ID is required for each item.'),
    body('items.*.quantity')
      .isFloat({ min: 0.01 })
      .withMessage('Quantity must be greater than 0.'),
    body('items.*.unitPrice')
      .isFloat({ min: 0 })
      .withMessage('Unit price must be 0 or more.'),
    body('status')
      .optional()
      .isIn(['RECEIVED', 'PENDING'])
      .withMessage('Status must be RECEIVED or PENDING.'),
  ]),
  createPurchase
);

// GET /api/purchases/:id
router.get('/purchases/:id', authorize('ADMIN', 'MANAGER'), getPurchaseById);

export default router;
