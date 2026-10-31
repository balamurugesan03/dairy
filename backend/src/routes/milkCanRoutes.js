import express from 'express';
import {
  getMilkCans,
  lookupCan,
  createMilkCan,
  updateMilkCan,
  deleteMilkCan
} from '../controllers/milkCanController.js';

const router = express.Router();

// Sub centre a can number last came from (query: canNumber)
router.get('/lookup', lookupCan);

// Cans of one date + shift with the sub-centre comparison (query: date, shift)
router.get('/', getMilkCans);
router.post('/', createMilkCan);
router.put('/:id', updateMilkCan);
router.delete('/:id', deleteMilkCan);

export default router;
