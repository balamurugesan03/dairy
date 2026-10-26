import express from 'express';
import {
  getCompanyUsers,
  getCompanyUser,
  createCompanyUser,
  updateCompanyUser,
  resetCompanyUserPassword,
  deleteCompanyUser,
  getModulesList,
  getDesignationsList,
  getUserTypesList
} from '../controllers/userManagementController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';
import { isAdminUser } from '../utils/milkScope.js';

const router = express.Router();

// Managing users: company login, admin accounts / Admin-type users, or a user granted
// "User Management" in User Management → Settings (permission settings.userManagement)
const canManageUsers = (req, res, next) => {
  if (req.userType === 'company' || isAdminUser(req.user || {})) return next();
  const perm = (req.user?.permissions || []).find(p => p.module === 'settings.userManagement');
  if (perm && (perm.read || perm.write || perm.edit || perm.delete)) return next();
  return res.status(403).json({ success: false, message: 'You do not have access to User Management' });
};

// All routes require authentication and company context
router.use(protect);
router.use(addCompanyFilter);
router.use(canManageUsers);

// Get modules, designations, and user types lists
router.get('/modules', getModulesList);
router.get('/designations', getDesignationsList);
router.get('/user-types', getUserTypesList);

// User management routes
router.route('/')
  .get(getCompanyUsers)
  .post(createCompanyUser);

router.route('/:id')
  .get(getCompanyUser)
  .put(updateCompanyUser)
  .delete(deleteCompanyUser);

router.patch('/:id/reset-password', resetCompanyUserPassword);

export default router;
