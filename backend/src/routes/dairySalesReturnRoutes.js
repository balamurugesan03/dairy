import express from 'express';
import {
  createDairySalesReturn,
  getAllDairySalesReturns,
  getDairySalesReturnById,
  updateDairySalesReturn,
  deleteDairySalesReturn,
  getDairySalesReturnSummary
} from '../controllers/dairySalesReturnController.js';

const router = express.Router();

// Summary - must be before :id routes
router.get('/summary', getDairySalesReturnSummary);

// CRUD routes
router.post('/', createDairySalesReturn);
router.get('/', getAllDairySalesReturns);
router.get('/:id', getDairySalesReturnById);
router.put('/:id', updateDairySalesReturn);
router.delete('/:id', deleteDairySalesReturn);

export default router;
