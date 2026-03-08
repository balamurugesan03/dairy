import express from 'express';
import {
  createSalesReturn,
  getAllSalesReturns,
  getSalesReturnById,
  updateSalesReturn,
  deleteSalesReturn,
  getSalesReturnSummary
} from '../controllers/salesReturnController.js';

const router = express.Router();

// Summary - must be before :id routes
router.get('/summary', getSalesReturnSummary);

// CRUD routes
router.post('/', createSalesReturn);
router.get('/', getAllSalesReturns);
router.get('/:id', getSalesReturnById);
router.put('/:id', updateSalesReturn);
router.delete('/:id', deleteSalesReturn);

export default router;
