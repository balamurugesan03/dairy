import express from 'express';
import {
  saveReading,
  getReadings,
  deleteReading
} from '../controllers/milkAnalyzerController.js';

const router = express.Router();

router.post('/',     saveReading);
router.get('/',      getReadings);
router.delete('/:id', deleteReading);

export default router;
