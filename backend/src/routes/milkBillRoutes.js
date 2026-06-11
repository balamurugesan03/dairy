import express from 'express';
import { getMilkBill, getMilkBillByCycle } from '../controllers/milkBillController.js';

const router = express.Router();

// GET /api/milk-bill/:farmerId/cycle?fromDate=&toDate=  — cycle-based (new)
router.get('/:farmerId/cycle', getMilkBillByCycle);

// GET /api/milk-bill/:farmerId?month=3&year=2020  — month-based (legacy)
router.get('/:farmerId', getMilkBill);

export default router;
