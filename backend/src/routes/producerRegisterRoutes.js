import express from 'express';
import {
  getProducerRegister,
  saveProducerRegister,
  getProducerRegisterSummary
} from '../controllers/producerRegisterController.js';

const router = express.Router();

/**
 * Producer Register Routes
 * Base path: /api/producer-register
 */

// Get summary for all farmers (must come before :farmerId route)
router.get('/summary', getProducerRegisterSummary);

// Get detailed register for a specific farmer
router.get('/:farmerId', getProducerRegister);

// Save register entries for a farmer
router.post('/:farmerId', saveProducerRegister);

export default router;
