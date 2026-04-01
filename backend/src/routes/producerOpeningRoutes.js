import express from 'express';
import {
  getOpenings,
  createOpening,
  updateOpening,
  deleteOpening,
  getOpeningByFarmer
} from '../controllers/producerOpeningController.js';

const router = express.Router();

router.get('/producer-openings', getOpenings);
router.post('/producer-openings', createOpening);
router.get('/producer-openings/farmer/:farmerId', getOpeningByFarmer);
router.put('/producer-openings/:id', updateOpening);
router.delete('/producer-openings/:id', deleteOpening);

export default router;
