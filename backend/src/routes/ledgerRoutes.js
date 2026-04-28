import express from 'express';
import {
  getAllLedgers,
  createLedger,
  getLedgerById,
  updateLedger,
  deleteLedger,
  getOutstandingReport,
  seedDefaultLedgers
} from '../controllers/ledgerController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Ledger routes
router.post('/ledgers/seed-defaults', seedDefaultLedgers);
router.get('/ledgers/outstanding-report', getOutstandingReport);
router.get('/ledgers', getAllLedgers);
router.post('/ledgers', createLedger);
router.get('/ledgers/:id', getLedgerById);
router.put('/ledgers/:id', updateLedger);
router.delete('/ledgers/:id', deleteLedger);

export default router;
