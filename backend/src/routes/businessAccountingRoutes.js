import express from 'express';
import {
  // Ledger
  createBusinessLedger,
  getAllBusinessLedgers,
  getBusinessLedgerById,
  updateBusinessLedger,
  deleteBusinessLedger,
  // Voucher
  createBusinessVoucher,
  getAllBusinessVouchers,
  getBusinessVoucherById,
  deleteBusinessVoucher,
  createIncomeVoucher,
  createExpenseVoucher,
  createJournalVoucher
} from '../controllers/businessAccountingController.js';

const router = express.Router();

// ==================== LEDGER ROUTES ====================
router.post('/ledgers', createBusinessLedger);
router.get('/ledgers', getAllBusinessLedgers);
router.get('/ledgers/:id', getBusinessLedgerById);
router.put('/ledgers/:id', updateBusinessLedger);
router.delete('/ledgers/:id', deleteBusinessLedger);

// ==================== VOUCHER ROUTES ====================
router.post('/vouchers', createBusinessVoucher);
router.get('/vouchers', getAllBusinessVouchers);
router.get('/vouchers/:id', getBusinessVoucherById);
router.delete('/vouchers/:id', deleteBusinessVoucher);

// Simplified voucher creation routes
router.post('/income-voucher', createIncomeVoucher);
router.post('/expense-voucher', createExpenseVoucher);
router.post('/journal-voucher', createJournalVoucher);

export default router;
