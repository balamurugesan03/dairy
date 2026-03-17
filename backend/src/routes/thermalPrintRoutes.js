import express from 'express';
import { printMilkReceipt, printerStatus } from '../controllers/thermalPrintController.js';

const router = express.Router();

router.get('/status',        printerStatus);
router.post('/milk-receipt', printMilkReceipt);

export default router;
