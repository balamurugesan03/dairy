import express from 'express';
import {
  createDairyPurchaseReturn,
  getAllDairyPurchaseReturns,
  getDairyPurchaseReturnById,
  updateDairyPurchaseReturn,
  deleteDairyPurchaseReturn,
  getDairyPurchaseReturnSummary
} from '../controllers/dairyPurchaseReturnController.js';

const router = express.Router();

// Summary - must be before :id routes
router.get('/summary', getDairyPurchaseReturnSummary);

// CRUD routes
router.post('/', createDairyPurchaseReturn);
router.get('/', getAllDairyPurchaseReturns);
router.get('/:id', getDairyPurchaseReturnById);
router.put('/:id', updateDairyPurchaseReturn);
router.delete('/:id', deleteDairyPurchaseReturn);

export default router;
