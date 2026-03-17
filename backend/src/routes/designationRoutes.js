import express from 'express';
import {
  createDesignation,
  getAllDesignations,
  getDesignationById,
  updateDesignation,
  deleteDesignation,
  getActiveDesignations
} from '../controllers/designationController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Active designations
router.get('/active', getActiveDesignations);

// CRUD operations
router.post('/', createDesignation);
router.get('/', getAllDesignations);
router.get('/:id', getDesignationById);
router.put('/:id', updateDesignation);
router.delete('/:id', deleteDesignation);

export default router;
