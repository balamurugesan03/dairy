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

import {
  getFarmerLedger,
  getLedgerSummary,
  checkWelfareRecovery,
  getFarmerOutstandingByType
} from '../controllers/farmerLedgerController.js';

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

// ==================== FARMER LEDGER ROUTES (must be before :farmerId and :id routes) ====================

// Get farmer ledger with running balance
router.get('/farmer-payments/farmer/:farmerId/ledger', getFarmerLedger);

// Get farmer ledger summary
router.get('/farmer-payments/farmer/:farmerId/summary', getLedgerSummary);

// Check welfare recovery eligibility
router.get('/farmer-payments/farmer/:farmerId/welfare-check', checkWelfareRecovery);

// Get farmer outstanding by type (for priority deduction)
router.get('/farmer-payments/farmer/:farmerId/outstanding-by-type', getFarmerOutstandingByType);

// ==================== FARMER PAYMENT DETAIL ROUTES ====================

// Get farmer payment history (must be after ledger routes but before :id route)
router.get('/farmer-payments/farmer/:farmerId', getFarmerPaymentHistory);

// Get single payment by ID
router.get('/farmer-payments/:id', getPaymentById);

// Update payment
router.put('/farmer-payments/:id', updatePayment);

// Cancel payment
router.post('/farmer-payments/:id/cancel', cancelPayment);

// ==================== ADVANCE ROUTES ====================

// Create new advance
router.post('/advances', createAdvance);

// Get all advances with filters
router.get('/advances', getAllAdvances);

// Get advance statistics
router.get('/advances/stats', getAdvanceStats);

// Get farmer advances (must be before :id route)
router.get('/advances/farmer/:farmerId', getFarmerAdvances);

// Get single advance by ID
router.get('/advances/:id', getAdvanceById);

// Update advance
router.put('/advances/:id', updateAdvance);

// Adjust advance
router.post('/advances/:id/adjust', adjustAdvance);

// Cancel advance
router.post('/advances/:id/cancel', cancelAdvance);

export default router;
