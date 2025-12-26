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

const router = express.Router();

router.get('/receipts-disbursement', getReceiptsDisbursementReport);
router.get('/trading-account', getTradingAccount);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/sales', getSalesReport);
router.get('/stock', getStockReport);
router.get('/subsidy', getSubsidyReport);

export default router;
