import express from 'express';
import {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
  searchFarmer,
  toggleMembership,
  addShareToFarmer,
  getShareHistory,
  terminateFarmer
} from '../controllers/farmerController.js';

const router = express.Router();

// Create new farmer
router.post('/', createFarmer);

// Get all farmers
router.get('/', getAllFarmers);

// Search farmer by farmer number or mobile
router.get('/search', searchFarmer);

// Get farmer by ID
router.get('/:id', getFarmerById);

// Get share history for a farmer
router.get('/:id/shares', getShareHistory);

// Add shares to farmer
router.post('/:id/shares', addShareToFarmer);

// Update farmer
router.put('/:id', updateFarmer);

// Toggle membership status
router.patch('/:id/membership', toggleMembership);

// Terminate farmer membership
router.post('/:id/terminate', terminateFarmer);

// Delete/Deactivate farmer
router.delete('/:id', deleteFarmer);

export default router;
