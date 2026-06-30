import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStock,
  getExpiring,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/inventoryController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(verifyToken);

// --- Product Routes ---

// GET /api/inventory/products
router.get('/products', authorize('ADMIN', 'MANAGER', 'CASHIER'), getProducts);

// POST /api/inventory/products
router.post(
  '/products',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').trim().notEmpty().withMessage('Product name is required.'),
    body('sku').optional().trim(),
    body('categoryId').optional().isInt({ min: 1 }).withMessage('Valid category ID is required.'),
    body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Purchase price must be 0 or more.'),
    body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be 0 or more.'),
    body('stockQty').optional().isFloat({ min: 0 }).withMessage('Stock quantity must be 0 or more.'),
    body('unit').optional().trim().notEmpty().withMessage('Unit cannot be empty.'),
    body('lowStockAlert').optional().isFloat({ min: 0 }).withMessage('Low stock alert must be 0 or more.'),
    body('expiryDate').optional({ values: 'null' }).isISO8601().withMessage('Valid date required.'),
  ]),
  createProduct
);

// GET /api/products/low-stock
router.get('/products/low-stock', authorize('ADMIN', 'MANAGER'), getLowStock);

// GET /api/products/expiring
router.get('/products/expiring', authorize('ADMIN', 'MANAGER'), getExpiring);

// PUT /api/products/:id
router.put(
  '/products/:id',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty.'),
    body('sku').optional().trim().notEmpty().withMessage('SKU cannot be empty.'),
    body('categoryId').optional().isInt({ min: 1 }).withMessage('Valid category ID required.'),
    body('purchasePrice').optional().isFloat({ min: 0 }).withMessage('Purchase price must be 0 or more.'),
    body('salePrice').optional().isFloat({ min: 0 }).withMessage('Sale price must be 0 or more.'),
    body('stockQty').optional().isFloat({ min: 0 }).withMessage('Stock quantity must be 0 or more.'),
    body('unit').optional().trim().notEmpty().withMessage('Unit cannot be empty.'),
  ]),
  updateProduct
);

// DELETE /api/products/:id
router.delete('/products/:id', authorize('ADMIN', 'MANAGER'), deleteProduct);

// --- Category Routes ---

// GET /api/categories
router.get('/categories', authorize('ADMIN', 'MANAGER', 'CASHIER'), getCategories);

// POST /api/categories
router.post(
  '/categories',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').trim().notEmpty().withMessage('Category name is required.'),
    body('description').optional().trim(),
  ]),
  createCategory
);

// PUT /api/categories/:id
router.put(
  '/categories/:id',
  authorize('ADMIN', 'MANAGER'),
  validate([
    body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty.'),
    body('description').optional().trim(),
  ]),
  updateCategory
);

// DELETE /api/categories/:id
router.delete('/categories/:id', authorize('ADMIN', 'MANAGER'), deleteCategory);

export default router;
