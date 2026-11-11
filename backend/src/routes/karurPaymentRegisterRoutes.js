import express from 'express';
import {
  getOptions, generate, createRegister, listRegisters, getRegister,
  updateRegister, cancelRegister, emailReport,
} from '../controllers/karurPaymentRegisterController.js';

// Producer Dues → Payments → Payment Register (Karur, Tamil Nadu)
const router = express.Router();

router.get('/options',     getOptions);
router.post('/generate',   generate);
router.post('/email',      emailReport);
router.get('/',            listRegisters);
router.post('/',           createRegister);
router.get('/:id',         getRegister);
router.put('/:id',         updateRegister);
router.post('/:id/cancel', cancelRegister);

export default router;
