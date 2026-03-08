import express from 'express';
import {
  getMilkSalesRates,
  getLatestRate,
  getRateHistory,
  createMilkSalesRate,
  updateMilkSalesRate
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

export default router;
