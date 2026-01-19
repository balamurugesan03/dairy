import express from 'express';
import {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem,
  stockIn,
  stockOut,
  getStockTransactions,
  getStockTransactionById,
  updateStockTransaction,
  deleteStockTransaction,
  getStockBalance,
  updateOpeningBalance,
  updateSalesPrice
} from '../controllers/inventoryController.js';

const router = express.Router();

// Item routes
router.post('/items', createItem);
router.get('/items', getAllItems);
router.get('/items/:id', getItemById);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);
router.patch('/items/:id/opening-balance', updateOpeningBalance);
router.patch('/items/:id/sales-price', updateSalesPrice);

// Stock transaction routes
router.post('/stock/in', stockIn);
router.post('/stock/out', stockOut);
router.get('/stock/transactions', getStockTransactions);
router.get('/stock/transactions/:id', getStockTransactionById);
router.put('/stock/transactions/:id', updateStockTransaction);
router.delete('/stock/transactions/:id', deleteStockTransaction);
router.get('/stock/balance', getStockBalance);

export default router;
