import { Router } from 'express';
import { body } from 'express-validator';
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  getCustomerById,
  getCustomerLedger,
} from '../controllers/customerController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(verifyToken);

// GET /api/customers
router.get('/', authorize('ADMIN', 'MANAGER', 'CASHIER'), getCustomers);

// POST /api/customers
router.post(
  '/',
  authorize('ADMIN', 'MANAGER', 'CASHIER'),
  validate([
    body('name').trim().notEmpty().withMessage('Customer name is required.'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('address').optional().trim(),
  ]),
  createCustomer
);

// GET /api/customers/:id
router.get('/:id', authorize('ADMIN', 'MANAGER', 'CASHIER'), getCustomerById);

// PUT /api/customers/:id
router.put(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty.'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('address').optional().trim(),
  ]),
  updateCustomer
);

// GET /api/customers/:id/ledger
router.get('/:id/ledger', authorize('ADMIN', 'MANAGER'), getCustomerLedger);

export default router;
