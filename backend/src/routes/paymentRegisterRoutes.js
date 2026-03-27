import express from 'express';
import {
  getPaymentRegisters,
  getPaymentRegister,
  generatePaymentRegister,
  generateProducerPaymentRegister,
  createPaymentRegister,
  updatePaymentRegister,
  deletePaymentRegister,
} from '../controllers/paymentRegisterController.js';

const router = express.Router();

router.get('/',                    getPaymentRegisters);
router.get('/:id',                 getPaymentRegister);
router.post('/generate',           generatePaymentRegister);
router.post('/generate-producers', generateProducerPaymentRegister);
router.post('/',                   createPaymentRegister);
router.put('/:id',                 updatePaymentRegister);
router.delete('/:id',              deletePaymentRegister);

export default router;
