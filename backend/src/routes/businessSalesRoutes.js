import express from 'express';
import {
  createBusinessSale,
  getAllBusinessSales,
  getBusinessSaleById,
  updateBusinessSale,
  deleteBusinessSale,
  getPartySalesHistory,
  getBusinessSalesSummary
} from '../controllers/businessSalesController.js';

const router = express.Router();

// Summary/Dashboard - must be before :id routes
router.get('/summary', getBusinessSalesSummary);

// Party history
router.get('/party/:partyId/history', getPartySalesHistory);

// CRUD routes
router.post('/', createBusinessSale);
router.get('/', getAllBusinessSales);
router.get('/:id', getBusinessSaleById);
router.put('/:id', updateBusinessSale);
router.delete('/:id', deleteBusinessSale);

export default router;
