import express from 'express';
import {
  retrieveBalances,
  applyBankTransfer,
  createFromLedger,
  getAllBankTransfers,
  getBankTransferById,
  cancelBankTransfer,
  completeTransfer,
  getCollectionCenters,
  getBanks,
  getPendingPeriods,
} from '../controllers/bankTransferController.js';

const router = express.Router();

// Retrieve producer balances for bank transfer
router.post('/bank-transfers/retrieve', retrieveBalances);

// Apply bank transfer
router.post('/bank-transfers/apply', applyBankTransfer);

// Create bank transfer log from Register-Ledger
router.post('/bank-transfers/from-ledger', createFromLedger);

// Get all bank transfers (transfer log)
router.get('/bank-transfers', getAllBankTransfers);

// Get dropdown data
router.get('/bank-transfers/collection-centers', getCollectionCenters);
router.get('/bank-transfers/banks', getBanks);
router.get('/bank-transfers/pending-periods', getPendingPeriods);

// Get single bank transfer by ID
router.get('/bank-transfers/:id', getBankTransferById);

// Cancel bank transfer
router.post('/bank-transfers/:id/cancel', cancelBankTransfer);

// Mark transfer as completed
router.post('/bank-transfers/:id/complete', completeTransfer);

export default router;
