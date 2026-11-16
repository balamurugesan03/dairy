import { ensureCashOpeningSynced } from '../utils/cashInHandOpening.js';
import express from 'express';
import {
  createVoucher,
  getAllVouchers,
  getCashBookEntry,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  getOutstandingReport
} from '../controllers/accountingController.js';
import { getOutstandingReport as getOutstandingRangeReport } from '../controllers/ledgerController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Voucher routes
router.post('/vouchers', createVoucher);
router.get('/vouchers', getAllVouchers);
router.get('/vouchers/cash-book-entry', ensureCashOpeningSynced, getCashBookEntry);
router.get('/vouchers/:id', getVoucherById);
router.put('/vouchers/:id', updateVoucher);
router.delete('/vouchers/:id', deleteVoucher);

// Ledger routes — list / create / read / update live in ledgerRoutes
// (ledgerController). This router is mounted first, so defining them here too
// shadowed those handlers: the single-Cash-in-Hand guard on create/rename, the
// duplicate merge on list, the opening sync on update, and GET
// /ledgers/cash-in-hand (swallowed by /ledgers/:id) never ran.
router.get('/ledgers/outstanding-report', getOutstandingRangeReport);
router.get('/ledgers/:id/outstanding', getOutstandingReport);

export default router;
