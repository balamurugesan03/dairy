import express from 'express';
import { printMilkReceipt, printMilkSalesReceipt, printerStatus } from '../controllers/thermalPrintController.js';

const router = express.Router();

router.get('/status',               printerStatus);
router.post('/milk-receipt',        printMilkReceipt);
router.post('/milk-sales-receipt',  printMilkSalesReceipt);

export default router;
