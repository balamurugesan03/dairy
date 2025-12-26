import express from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  deleteSale,
  getCustomerHistory
} from '../controllers/salesController.js';

const router = express.Router();

// Create new sale
router.post('/', createSale);

// Get all sales
router.get('/', getAllSales);

// Get sale by ID
router.get('/:id', getSaleById);

// Update sale
router.put('/:id', updateSale);

// Delete sale
router.delete('/:id', deleteSale);

// Get customer purchase history
router.get('/customer/:customerId', getCustomerHistory);

export default router;
