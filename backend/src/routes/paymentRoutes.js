import express from 'express';
import {
  // Payment functions
  createFarmerPayment,
  getAllPayments,
  getPaymentById,
  getFarmerPaymentHistory,
  updatePayment,
  cancelPayment,
  getPaymentStats,
  bulkCreatePayments,
  // Advance functions
  createAdvance,
  getAllAdvances,
  getAdvanceById,
  getFarmerAdvances,
  updateAdvance,
  adjustAdvance,
  cancelAdvance,
  getAdvanceStats
} from '../controllers/paymentController.js';

const router = express.Router();

// ==================== FARMER PAYMENT ROUTES ====================

// Create new farmer payment
router.post('/farmer-payments', createFarmerPayment);

// Bulk create payments
router.post('/farmer-payments/bulk', bulkCreatePayments);

// Get all payments with filters
router.get('/farmer-payments', getAllPayments);

// Get payment statistics
router.get('/farmer-payments/stats', getPaymentStats);

// Get single payment by ID
router.get('/farmer-payments/:id', getPaymentById);

// Update payment
router.put('/farmer-payments/:id', updatePayment);

// Cancel payment
router.post('/farmer-payments/:id/cancel', cancelPayment);

// Get farmer payment history
router.get('/farmer-payments/farmer/:farmerId', getFarmerPaymentHistory);

// ==================== ADVANCE ROUTES ====================

// Create new advance
router.post('/advances', createAdvance);

// Get all advances with filters
router.get('/advances', getAllAdvances);

// Get advance statistics
router.get('/advances/stats', getAdvanceStats);

// Get single advance by ID
router.get('/advances/:id', getAdvanceById);

// Update advance
router.put('/advances/:id', updateAdvance);

// Adjust advance
router.post('/advances/:id/adjust', adjustAdvance);

// Cancel advance
router.post('/advances/:id/cancel', cancelAdvance);

// Get farmer advances
router.get('/advances/farmer/:farmerId', getFarmerAdvances);

export default router;
