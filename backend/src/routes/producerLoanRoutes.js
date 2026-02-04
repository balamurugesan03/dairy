import express from 'express';
import {
  createLoan,
  getAllLoans,
  getLoanById,
  getFarmerLoans,
  updateLoan,
  cancelLoan,
  recordEMIPayment,
  getLoanStats
} from '../controllers/producerLoanController.js';

const router = express.Router();

// Create new loan
router.post('/producer-loans', createLoan);

// Get all loans with filters
router.get('/producer-loans', getAllLoans);

// Get loan statistics
router.get('/producer-loans/stats', getLoanStats);

// Get farmer's loans (must be before :id route)
router.get('/producer-loans/farmer/:farmerId', getFarmerLoans);

// Get single loan by ID
router.get('/producer-loans/:id', getLoanById);

// Update loan
router.put('/producer-loans/:id', updateLoan);

// Cancel loan
router.post('/producer-loans/:id/cancel', cancelLoan);

// Record EMI payment
router.post('/producer-loans/:id/emi', recordEMIPayment);

export default router;
