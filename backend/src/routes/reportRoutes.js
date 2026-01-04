import express from 'express';
import {
  getReceiptsDisbursementReport,
  getTradingAccount,
  getProfitLoss,
  getBalanceSheet,
  getSalesReport,
  getStockReport,
  getSubsidyReport
} from '../controllers/reportController.js';
import { getDayBook } from '../controllers/dayBookController.js';

const router = express.Router();

router.get('/receipts-disbursement', getReceiptsDisbursementReport);
router.get('/trading-account', getTradingAccount);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/sales', getSalesReport);
router.get('/stock', getStockReport);
router.get('/subsidy', getSubsidyReport);
router.get('/day-book', getDayBook);

export default router;
