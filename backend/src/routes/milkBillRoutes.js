import express from 'express';
import { getMilkBill, getMilkBillByCycle, getAllMilkBillsByCycle, getKarurProducers, getKarurMilkBills } from '../controllers/milkBillController.js';

const router = express.Router();

// GET /api/milk-bill/all/cycle?fromDate=&toDate=&centerId=  — every producer of the cycle (before /:farmerId)
router.get('/all/cycle', getAllMilkBillsByCycle);

// Milk Bill (Karur, Tamil Nadu) — before /:farmerId
router.get('/karur/producers', getKarurProducers);
router.get('/karur/bills',     getKarurMilkBills);

// GET /api/milk-bill/:farmerId/cycle?fromDate=&toDate=  — cycle-based (new)
router.get('/:farmerId/cycle', getMilkBillByCycle);

// GET /api/milk-bill/:farmerId?month=3&year=2020  — month-based (legacy)
router.get('/:farmerId', getMilkBill);

export default router;
