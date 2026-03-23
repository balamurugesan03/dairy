import express from 'express';
import {
  getReceiptsDisbursementReport,
  getTradingAccount,
  getProfitLoss,
  getBalanceSheet,
  getSalesReport,
  getStockReport,
  getSubsidyReport,
  getStockRegister,
  getInventoryPurchaseRegister,
  getSalesRegister,
  getMilkBillAbstractReport,
  getDairyAbstractReport,
  getDairyRegisterReport,
  getCooperativeRDReport
} from '../controllers/reportController.js';
import { getDayBook } from '../controllers/dayBookController.js';
import {
  getCashBook,
  getGeneralLedger,
  getGeneralLedgerAbstract,
  getReceiptsDisbursementEnhanced,
  getLedgersForDropdown
} from '../controllers/accountingReportsController.js';
import {
  getSaleReport,
  getPurchaseReport,
  getPartyStatement,
  getCashflowReport,
  getCashInHandReport,
  getAllTransactions,
  getVyaparProfitLoss,
  getVyaparBalanceSheet,
  getBillWiseProfit,
  getPartyWiseProfit,
  getTrialBalance,
  getStockSummary,
  getItemByParty,
  getItemWiseProfit,
  getLowStockSummary,
  getBankStatement,
  getAllPartiesReport,
  getGSTR1Report,
  getGSTR2Report,
  getStockStatement,
  getVyaparDayBook,
  getVyaparCashBook,
  getVyaparTradingAccount,
  getVyaparRD
} from '../controllers/vyaparReportsController.js';

const router = express.Router();

// Existing routes
router.get('/receipts-disbursement', getReceiptsDisbursementReport);
router.get('/trading-account', getTradingAccount);
router.get('/profit-loss', getProfitLoss);
router.get('/balance-sheet', getBalanceSheet);
router.get('/sales', getSalesReport);
router.get('/stock', getStockReport);
router.get('/subsidy', getSubsidyReport);
router.get('/day-book', getDayBook);
router.get('/stock-register', getStockRegister);
router.get('/inventory-purchase-register', getInventoryPurchaseRegister);
router.get('/sales-register', getSalesRegister);
router.get('/milk-bill-abstract', getMilkBillAbstractReport);
router.get('/dairy-abstract', getDairyAbstractReport);
router.get('/dairy-register', getDairyRegisterReport);
router.get('/cooperative-rd', getCooperativeRDReport);

// New accounting reports routes
router.get('/cash-book', getCashBook);
router.get('/general-ledger', getGeneralLedger);
router.get('/ledger-abstract', getGeneralLedgerAbstract);
router.get('/rd-enhanced', getReceiptsDisbursementEnhanced);
router.get('/ledgers-dropdown', getLedgersForDropdown);

// Vyapar Reports - Private Firm
router.get('/vyapar/sale-report', getSaleReport);
router.get('/vyapar/purchase-report', getPurchaseReport);
router.get('/vyapar/party-statement', getPartyStatement);
router.get('/vyapar/cashflow', getCashflowReport);
router.get('/vyapar/cash-in-hand', getCashInHandReport);
router.get('/vyapar/all-transactions', getAllTransactions);
router.get('/vyapar/profit-loss', getVyaparProfitLoss);
router.get('/vyapar/balance-sheet', getVyaparBalanceSheet);
router.get('/vyapar/bill-profit', getBillWiseProfit);
router.get('/vyapar/party-profit', getPartyWiseProfit);
router.get('/vyapar/trial-balance', getTrialBalance);
router.get('/vyapar/stock-summary', getStockSummary);
router.get('/vyapar/item-by-party', getItemByParty);
router.get('/vyapar/item-profit', getItemWiseProfit);
router.get('/vyapar/low-stock', getLowStockSummary);
router.get('/vyapar/bank-statement', getBankStatement);
router.get('/vyapar/all-parties', getAllPartiesReport);
router.get('/vyapar/gstr1', getGSTR1Report);
router.get('/vyapar/gstr2', getGSTR2Report);
router.get('/vyapar/stock-statement', getStockStatement);
router.get('/vyapar/day-book', getVyaparDayBook);
router.get('/vyapar/cash-book', getVyaparCashBook);
router.get('/vyapar/trading-account', getVyaparTradingAccount);
router.get('/vyapar/rd', getVyaparRD);

export default router;
