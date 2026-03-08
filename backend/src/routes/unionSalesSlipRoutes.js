import express from 'express';
import {
  createSlip,
  getAllSlips,
  getSlipById,
  updateSlip,
  deleteSlip,
} from '../controllers/unionSalesSlipController.js';

const router = express.Router();

router.post('/',      createSlip);
router.get('/',       getAllSlips);
router.get('/:id',    getSlipById);
router.put('/:id',    updateSlip);
router.delete('/:id', deleteSlip);

export default router;
