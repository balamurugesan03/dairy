import express from 'express';
import {
  login,
  getMe,
  changePassword,
  createUser,
  getAllUsers,
  getUser,
  updateUser,
  resetUserPassword,
  deleteUser
} from '../controllers/authController.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes - require authentication
router.use(protect);

router.get('/me', getMe);
router.patch('/change-password', changePassword);

// Superadmin only routes - user management
router.use('/users', restrictTo('superadmin'));

router.route('/users')
  .get(getAllUsers)
  .post(createUser);

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser);

router.patch('/users/:id/reset-password', resetUserPassword);

export default router;
