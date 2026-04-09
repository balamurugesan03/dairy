import express from 'express';
import {
  getPaymentRegisters,
  getPaymentRegister,
  generatePaymentRegister,
  generateProducerPaymentRegister,
  createPaymentRegister,
  updatePaymentRegister,
  deletePaymentRegister,
  getProducersForPeriod,
  getLatestProducers,
  applyEntryPayment,
} from '../controllers/paymentRegisterController.js';

const router = express.Router();

router.get('/producers-for-period',                        getProducersForPeriod);
router.get('/producers-latest',                            getLatestProducers);
router.post('/:registerId/entries/:entryId/apply',         applyEntryPayment);
router.get('/',                    getPaymentRegisters);
router.get('/:id',                 getPaymentRegister);
router.post('/generate',           generatePaymentRegister);
router.post('/generate-producers', generateProducerPaymentRegister);
router.post('/',                   createPaymentRegister);
router.put('/:id',                 updatePaymentRegister);
router.delete('/:id',              deletePaymentRegister);

export default router;
