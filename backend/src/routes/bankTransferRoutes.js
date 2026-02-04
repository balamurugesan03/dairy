import express from 'express';
import {
  retrieveBalances,
  applyBankTransfer,
  getAllBankTransfers,
  getBankTransferById,
  cancelBankTransfer,
  completeTransfer,
  getCollectionCenters,
  getBanks
} from '../controllers/bankTransferController.js';

const router = express.Router();

// Retrieve producer balances for bank transfer
router.post('/bank-transfers/retrieve', retrieveBalances);

// Apply bank transfer
router.post('/bank-transfers/apply', applyBankTransfer);

// Get all bank transfers (transfer log)
router.get('/bank-transfers', getAllBankTransfers);

// Get dropdown data
router.get('/bank-transfers/collection-centers', getCollectionCenters);
router.get('/bank-transfers/banks', getBanks);

// Get single bank transfer by ID
router.get('/bank-transfers/:id', getBankTransferById);

// Cancel bank transfer
router.post('/bank-transfers/:id/cancel', cancelBankTransfer);

// Mark transfer as completed
router.post('/bank-transfers/:id/complete', completeTransfer);

export default router;
