import express from 'express';
import {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  deleteVoucher,
  createLedger,
  getAllLedgers,
  getLedgerById,
  updateLedger,
  getOutstandingReport
} from '../controllers/accountingController.js';

const router = express.Router();

// Voucher routes
router.post('/vouchers', createVoucher);
router.get('/vouchers', getAllVouchers);
router.get('/vouchers/:id', getVoucherById);
router.delete('/vouchers/:id', deleteVoucher);

// Ledger routes
router.post('/ledgers', createLedger);
router.get('/ledgers', getAllLedgers);
router.get('/ledgers/:id', getLedgerById);
router.put('/ledgers/:id', updateLedger);
router.get('/ledgers/:id/outstanding', getOutstandingReport);

export default router;
