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
import { canManageUsersReq } from '../utils/userTier.js';

const router = express.Router();

// Managing users: Super Admin and Admin only — never ordinary users, whatever was assigned
const canManageUsers = (req, res, next) => {
  if (canManageUsersReq(req)) return next();
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
