import { Router } from 'express';
import { body } from 'express-validator';
import { signup, login, getMe, changePassword } from '../controllers/authController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

// POST /api/auth/signup - Admin only
router.post(
  '/signup',
  verifyToken,
  authorize('ADMIN'),
  validate([
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),
    body('role')
      .optional()
      .isIn(['ADMIN', 'MANAGER', 'CASHIER'])
      .withMessage('Role must be ADMIN, MANAGER, or CASHIER.'),
  ]),
  signup
);

// POST /api/auth/login
router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ]),
  login
);

// GET /api/auth/me
router.get('/me', verifyToken, getMe);

// PUT /api/auth/change-password
router.put(
  '/change-password',
  verifyToken,
  validate([
    body('oldPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters.'),
  ]),
  changePassword
);

export default router;
