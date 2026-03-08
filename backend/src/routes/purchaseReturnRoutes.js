import express from 'express';
import {
  createPurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnById,
  updatePurchaseReturn,
  deletePurchaseReturn,
  getPurchaseReturnSummary
} from '../controllers/purchaseReturnController.js';

const router = express.Router();

// Summary - must be before :id routes
router.get('/summary', getPurchaseReturnSummary);

// CRUD routes
router.post('/', createPurchaseReturn);
router.get('/', getAllPurchaseReturns);
router.get('/:id', getPurchaseReturnById);
router.put('/:id', updatePurchaseReturn);
router.delete('/:id', deletePurchaseReturn);

export default router;
