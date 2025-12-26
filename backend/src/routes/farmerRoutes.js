import express from 'express';
import {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
  searchFarmer
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

// Update farmer
router.put('/:id', updateFarmer);

// Delete/Deactivate farmer
router.delete('/:id', deleteFarmer);

export default router;
