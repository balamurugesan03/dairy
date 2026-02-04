import express from 'express';
import {
  createBusinessItem,
  getAllBusinessItems,
  getBusinessItemById,
  updateBusinessItem,
  deleteBusinessItem,
  businessStockIn,
  businessStockOut,
  getBusinessStockTransactions,
  getBusinessStockTransactionById,
  updateBusinessStockTransaction,
  deleteBusinessStockTransaction,
  getBusinessStockBalance,
  updateBusinessOpeningBalance,
  updateBusinessSalesPrice
} from '../controllers/businessInventoryController.js';

const router = express.Router();

// Business Item routes
router.post('/items', createBusinessItem);
router.get('/items', getAllBusinessItems);
router.get('/items/:id', getBusinessItemById);
router.put('/items/:id', updateBusinessItem);
router.delete('/items/:id', deleteBusinessItem);
router.patch('/items/:id/opening-balance', updateBusinessOpeningBalance);
router.patch('/items/:id/prices', updateBusinessSalesPrice);

// Business Stock transaction routes
router.post('/stock/in', businessStockIn);
router.post('/stock/out', businessStockOut);
router.get('/stock/transactions', getBusinessStockTransactions);
router.get('/stock/transactions/:id', getBusinessStockTransactionById);
router.put('/stock/transactions/:id', updateBusinessStockTransaction);
router.delete('/stock/transactions/:id', deleteBusinessStockTransaction);
router.get('/stock/balance', getBusinessStockBalance);

export default router;
