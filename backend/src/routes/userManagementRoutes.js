import express from 'express';
import {
  getCompanyUsers,
  getCompanyUser,
  createCompanyUser,
  updateCompanyUser,
  resetCompanyUserPassword,
  deleteCompanyUser,
  getModulesList,
  getDesignationsList
} from '../controllers/userManagementController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and company context
router.use(protect);
router.use(addCompanyFilter);

// Get modules and designations lists
router.get('/modules', getModulesList);
router.get('/designations', getDesignationsList);

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
