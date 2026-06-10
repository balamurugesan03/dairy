import express from 'express';
import {
  createCollectionCenter,
  getAllCollectionCenters,
  getCollectionCenterById,
  updateCollectionCenter,
  deleteCollectionCenter,
  toggleStatus,
  bulkImportCollectionCenters,
  setCentreCredentials,
  getCentreCredentials
} from '../controllers/collectionCenterController.js';

const router = express.Router();

// Bulk import from OpenLyssa (must be before /:id routes)
router.post('/bulk-import', bulkImportCollectionCenters);

// Create new collection center
router.post('/', createCollectionCenter);

// Get all collection centers (with pagination and filters)
router.get('/', getAllCollectionCenters);

// Sub-centre login credentials (must be before /:id)
router.put('/:id/credentials', setCentreCredentials);
router.get('/:id/credentials', getCentreCredentials);

// Get collection center by ID
router.get('/:id', getCollectionCenterById);

// Update collection center
router.put('/:id', updateCollectionCenter);

// Toggle status (Active/Inactive)
router.patch('/:id/status', toggleStatus);

// Delete/Deactivate collection center
router.delete('/:id', deleteCollectionCenter);

export default router;
