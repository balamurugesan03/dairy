import express from 'express';
import { getMilkBill } from '../controllers/milkBillController.js';

const router = express.Router();

// GET /api/milk-bill/:farmerId?month=3&year=2020
router.get('/:farmerId', getMilkBill);

export default router;
