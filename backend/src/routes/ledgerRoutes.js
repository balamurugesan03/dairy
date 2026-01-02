import express from 'express';
import {
  getAllLedgers,
  createLedger,
  getLedgerById,
  updateLedger,
  deleteLedger
} from '../controllers/ledgerController.js';

const router = express.Router();

// Ledger routes
router.get('/ledgers', getAllLedgers);
router.post('/ledgers', createLedger);
router.get('/ledgers/:id', getLedgerById);
router.put('/ledgers/:id', updateLedger);
router.delete('/ledgers/:id', deleteLedger);

export default router;
