import express from 'express';
import {
  createPayment,
  getPayments,
  getProducerBalance,
  updatePayment,
  cancelPayment,
  getCycles,
  getBankTransferPaid,
} from '../controllers/producerPaymentController.js';

const router = express.Router();

// Static routes must come before parameterised ones
router.get('/producer-payments/cycles',             getCycles);
router.get('/producer-payments/bank-transfer-paid', getBankTransferPaid);
router.get('/producer-payments',                    getPayments);
router.post('/producer-payments',                   createPayment);
router.get('/producer-payments/balance/:farmerId',  getProducerBalance);
router.put('/producer-payments/:id',                updatePayment);
router.post('/producer-payments/:id/cancel',        cancelPayment);

export default router;
