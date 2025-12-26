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
  getStockBalance
} from '../controllers/inventoryController.js';

const router = express.Router();

// Item routes
router.post('/items', createItem);
router.get('/items', getAllItems);
router.get('/items/:id', getItemById);
router.put('/items/:id', updateItem);
router.delete('/items/:id', deleteItem);

// Stock transaction routes
router.post('/stock/in', stockIn);
router.post('/stock/out', stockOut);
router.get('/stock/transactions', getStockTransactions);
router.get('/stock/balance', getStockBalance);

export default router;
