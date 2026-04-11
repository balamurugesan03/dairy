import express from 'express';
import {
  getPaymentRegisters,
  getPaymentRegister,
  generatePaymentRegister,
  generateProducerPaymentRegister,
  createPaymentRegister,
  updatePaymentRegister,
  deletePaymentRegister,
  reversePaymentRegister,
  getProducersForPeriod,
  getLatestProducers,
  applyEntryPayment,
} from '../controllers/paymentRegisterController.js';

const router = express.Router();

// Static GET routes first
router.get('/producers-for-period',  getProducersForPeriod);
router.get('/producers-latest',      getLatestProducers);
router.get('/',                      getPaymentRegisters);
router.get('/:id',                   getPaymentRegister);

// Static POST routes before parameterised ones
router.post('/generate',             generatePaymentRegister);
router.post('/generate-producers',   generateProducerPaymentRegister);
router.post('/',                     createPaymentRegister);

// Parameterised POST routes
router.post('/:registerId/entries/:entryId/apply', applyEntryPayment);
router.post('/:id/reverse',          reversePaymentRegister);

router.put('/:id',                   updatePaymentRegister);
router.delete('/:id',                deletePaymentRegister);

export default router;
