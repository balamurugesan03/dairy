import express from 'express';
import {
  createPayment,
  getPayments,
  getProducerBalance,
  updatePayment,
  cancelPayment
} from '../controllers/producerPaymentController.js';

const router = express.Router();

router.get('/producer-payments', getPayments);
router.post('/producer-payments', createPayment);
router.get('/producer-payments/balance/:farmerId', getProducerBalance);
router.put('/producer-payments/:id', updatePayment);
router.post('/producer-payments/:id/cancel', cancelPayment);

export default router;
