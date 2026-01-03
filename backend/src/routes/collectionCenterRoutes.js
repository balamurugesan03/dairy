import express from 'express';
import {
  createCollectionCenter,
  getAllCollectionCenters,
  getCollectionCenterById,
  updateCollectionCenter,
  deleteCollectionCenter,
  toggleStatus
} from '../controllers/collectionCenterController.js';

const router = express.Router();

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
