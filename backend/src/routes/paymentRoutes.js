import express from 'express';
import {
  createFarmerPayment,
  getAllPayments,
  getFarmerPaymentHistory,
  createAdvance,
  getAllAdvances,
  getFarmerAdvances,
  adjustAdvance
} from '../controllers/paymentController.js';

const router = express.Router();

// Farmer payment routes
router.post('/farmer-payments', createFarmerPayment);
router.get('/farmer-payments', getAllPayments);
router.get('/farmer-payments/farmer/:farmerId', getFarmerPaymentHistory);

// Advance routes
router.post('/advances', createAdvance);
router.get('/advances', getAllAdvances);
router.get('/advances/farmer/:farmerId', getFarmerAdvances);
router.post('/advances/:id/adjust', adjustAdvance);

export default router;
