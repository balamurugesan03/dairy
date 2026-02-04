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

const router = express.Router();

// All routes require authentication and company context
router.use(protect);
router.use(addCompanyFilter);

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
