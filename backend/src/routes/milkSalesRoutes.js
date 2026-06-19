import express from 'express';
import {
  getMilkSales,
  getMilkSaleById,
  getDailySummary,
  createMilkSale,
  updateMilkSale,
  deleteMilkSale,
  getBalanceReport,
  getCreditorBalance,
  getNextBillNo,
  bulkImportMilkSales,
  zibittRawImport,
  openLyssaImport,
  backfillMilkSaleVouchers,
  getMilkSalesReport,
} from '../controllers/milkSalesController.js';

const router = express.Router();

router.get('/',               getMilkSales);
router.get('/next-bill-no',   getNextBillNo);
router.get('/summary/daily',  getDailySummary);
router.get('/report',         getMilkSalesReport);
router.get('/balance-report',    getBalanceReport);
router.get('/creditor-balance',  getCreditorBalance);
router.get('/:id',            getMilkSaleById);
router.post('/bulk-import',       bulkImportMilkSales);
router.post('/zibitt-raw-import', zibittRawImport);
router.post('/openlyssa-import',  openLyssaImport);
router.post('/backfill-vouchers', backfillMilkSaleVouchers);
router.post('/',              createMilkSale);
router.put('/:id',            updateMilkSale);
router.delete('/:id',         deleteMilkSale);

export default router;
