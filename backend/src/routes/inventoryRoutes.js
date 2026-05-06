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
  updateSalesPrice,
  getNextSaleBillNumber,
  checkSaleDate,
  getInventorySales,
  createSale,
  updateSale,
  deleteSale
} from '../controllers/inventoryController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

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

// Inventory sales routes (static before parameterized)
router.get('/stock/next-sale-bill', getNextSaleBillNumber);
router.get('/stock/check-sale-date', checkSaleDate);
router.get('/stock/sales', getInventorySales);
router.post('/stock/sales', createSale);
router.put('/stock/sales/:billNumber', updateSale);
router.delete('/stock/sales/:billNumber', deleteSale);

export default router;
