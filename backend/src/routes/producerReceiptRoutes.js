import express from 'express';
import {
  createReceipt,
  getAllReceipts,
  getReceiptById,
  getFarmerReceipts,
  cancelReceipt,
  getReceiptPrintData
} from '../controllers/producerReceiptController.js';

const router = express.Router();

// Create new receipt
router.post('/producer-receipts', createReceipt);

// Get all receipts with filters
router.get('/producer-receipts', getAllReceipts);

// Get farmer's receipts (must be before :id route)
router.get('/producer-receipts/farmer/:farmerId', getFarmerReceipts);

// Get single receipt by ID
router.get('/producer-receipts/:id', getReceiptById);

// Cancel receipt
router.post('/producer-receipts/:id/cancel', cancelReceipt);

// Get print data
router.get('/producer-receipts/:id/print', getReceiptPrintData);

export default router;
