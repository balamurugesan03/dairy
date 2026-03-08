import express from 'express';
import {
  addLoan,
  getAllLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
  makePayment
} from '../controllers/loanController.js';

const router = express.Router();

router.post('/', addLoan);
router.get('/', getAllLoans);
router.get('/:id', getLoanById);
router.put('/:id', updateLoan);
router.delete('/:id', deleteLoan);
router.post('/:id/payment', makePayment);

export default router;
