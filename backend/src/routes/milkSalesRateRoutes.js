import express from 'express';
import {
  getMilkSalesRates,
  getLatestRate,
  getRateHistory,
  createMilkSalesRate,
  updateMilkSalesRate,
  deleteMilkSalesRate,
  bulkImportMilkSalesRates
} from '../controllers/milkSalesRateController.js';

const router = express.Router();

// GET all (paginated + search)
router.get('/', getMilkSalesRates);

// GET latest rate for billing (query: partyId, salesItem, date)
router.get('/latest', getLatestRate);

// GET rate history for a specific party
router.get('/history/:partyId', getRateHistory);

// POST create new rate
router.post('/', createMilkSalesRate);

// PUT update existing rate
router.put('/:id', updateMilkSalesRate);

// POST bulk import rates from OpenLyssa
router.post('/bulk-import', bulkImportMilkSalesRates);

// DELETE rate entry
router.delete('/:id', deleteMilkSalesRate);

export default router;
