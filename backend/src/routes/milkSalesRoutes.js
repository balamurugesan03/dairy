import express from 'express';
import {
  getMilkSales,
  getMilkSaleById,
  getDailySummary,
  createMilkSale,
  updateMilkSale,
  deleteMilkSale,
  getBalanceReport,
  getNextBillNo
} from '../controllers/milkSalesController.js';

const router = express.Router();

router.get('/',               getMilkSales);
router.get('/next-bill-no',   getNextBillNo);
router.get('/summary/daily',  getDailySummary);
router.get('/balance-report', getBalanceReport);
router.get('/:id',            getMilkSaleById);
router.post('/',              createMilkSale);
router.put('/:id',            updateMilkSale);
router.delete('/:id',         deleteMilkSale);

export default router;
