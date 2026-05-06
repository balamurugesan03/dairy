import express from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getCustomerHistory,
  getNextSaleBillNumber
} from '../controllers/salesController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Create new sale
router.post('/', createSale);

// Get all sales
router.get('/', getAllSales);

// Static routes must come before /:id
router.get('/next-bill-number', getNextSaleBillNumber);

// Get sale by ID
router.get('/:id', getSaleById);

// Update sale
router.put('/:id', updateSale);

// Delete sale
router.delete('/:id', deleteSale);

// Get customer purchase history
router.get('/customer/:customerId', getCustomerHistory);

export default router;
