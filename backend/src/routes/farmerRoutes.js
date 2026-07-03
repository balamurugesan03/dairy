import express from 'express';
import {
  createFarmer,
  getAllFarmers,
  getFarmerById,
  updateFarmer,
  deleteFarmer,
  searchFarmer,
  toggleMembership,
  activateMembership,
  getEligibleFarmers,
  addShareToFarmer,
  getShareHistory,
  terminateFarmer,
  bulkImportFarmers,
  bulkImportShares,
  bulkDeleteFarmers,
  getFarmerReport,
  getProducerReport
} from '../controllers/farmerController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Bulk import farmers (must be before other routes)
router.post('/bulk-import', bulkImportFarmers);

// Bulk import share transactions
router.post('/bulk-import-shares', bulkImportShares);

// Bulk delete farmers
router.post('/bulk-delete', bulkDeleteFarmers);

// Create new farmer
router.post('/', createFarmer);

// Get all farmers
router.get('/', getAllFarmers);

// Search farmer by farmer number or mobile
router.get('/search', searchFarmer);

// Farmer report — member/caste/gender/centre aggregations
router.get('/report', getFarmerReport);

// Producer report — filterable list with pouring days/qty conditions
router.get('/producer-report', getProducerReport);

// Farmers eligible for membership (500L supplied or 180-day tenure reached)
router.get('/eligible-for-membership', getEligibleFarmers);

// Get farmer by ID
router.get('/:id', getFarmerById);

// Get share history for a farmer
router.get('/:id/shares', getShareHistory);

// Add shares to farmer
router.post('/:id/shares', addShareToFarmer);

// Update farmer
router.put('/:id', updateFarmer);

// Toggle membership status (deactivation only — activation goes through /membership/activate)
router.patch('/:id/membership', toggleMembership);

// Activate membership with financial details + optional Farmer Number replacement
router.post('/:id/membership/activate', activateMembership);

// Terminate farmer membership
router.post('/:id/terminate', terminateFarmer);

// Delete/Deactivate farmer
router.delete('/:id', deleteFarmer);

export default router;
