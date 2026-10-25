import express from 'express';
import {
  getExpected,
  getMilkReceipts,
  createMilkReceipt,
  updateMilkReceipt,
  deleteMilkReceipt,
  getShortageReport
} from '../controllers/milkReceiptController.js';

const router = express.Router();

// Sub-centre totals for one route/date/shift (query: date, shift, routeId)
router.get('/expected', getExpected);

// Expected vs received shortage report (query: fromDate, toDate, shift?, routeId?)
router.get('/shortage-report', getShortageReport);

router.get('/', getMilkReceipts);
router.post('/', createMilkReceipt);
router.put('/:id', updateMilkReceipt);
router.delete('/:id', deleteMilkReceipt);

export default router;
