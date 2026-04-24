import express from 'express';
import {
  createCollectionCenter,
  getAllCollectionCenters,
  getCollectionCenterById,
  updateCollectionCenter,
  deleteCollectionCenter,
  toggleStatus,
  bulkImportCollectionCenters
} from '../controllers/collectionCenterController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Bulk import from OpenLyssa (must be before /:id routes)
router.post('/bulk-import', bulkImportCollectionCenters);

// Create new collection center
router.post('/', createCollectionCenter);

// Get all collection centers (with pagination and filters)
router.get('/', getAllCollectionCenters);

// Get collection center by ID
router.get('/:id', getCollectionCenterById);

// Update collection center
router.put('/:id', updateCollectionCenter);

// Toggle status (Active/Inactive)
router.patch('/:id/status', toggleStatus);

// Delete/Deactivate collection center
router.delete('/:id', deleteCollectionCenter);

export default router;
