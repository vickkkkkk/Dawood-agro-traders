import { Router } from 'express';
import { body } from 'express-validator';
import { getUsers, updateUser, deleteUser } from '../controllers/userController.js';
import verifyToken from '../middleware/auth.js';
import authorize from '../middleware/roleCheck.js';
import validate from '../middleware/validate.js';

const router = Router();

router.use(verifyToken);
router.use(authorize('ADMIN'));

// GET /api/users
router.get('/', getUsers);

// PUT /api/users/:id
router.put(
  '/:id',
  validate([
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('email').optional().isEmail().withMessage('Valid email required.').normalizeEmail(),
    body('role')
      .optional()
      .isIn(['ADMIN', 'MANAGER', 'CASHIER'])
      .withMessage('Role must be ADMIN, MANAGER, or CASHIER.'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),
  ]),
  updateUser
);

// DELETE /api/users/:id
router.delete('/:id', deleteUser);

export default router;
