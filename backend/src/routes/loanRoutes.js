import express from 'express';
import {
  addLoan,
  getAllLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
  makePayment,
  deleteRepayment
} from '../controllers/loanController.js';

const router = express.Router();

router.post('/', addLoan);
router.get('/', getAllLoans);
router.get('/:id', getLoanById);
router.put('/:id', updateLoan);
router.delete('/:id', deleteLoan);
router.post('/:id/payment', makePayment);
router.delete('/:id/repayments/:repaymentId', deleteRepayment);

export default router;
