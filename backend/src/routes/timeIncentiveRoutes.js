import express from 'express';
import {
  getAllTimeIncentives,
  getTimeIncentiveById,
  createTimeIncentive,
  updateTimeIncentive,
  deleteTimeIncentive,
  toggleTimeIncentiveStatus,
} from '../controllers/timeIncentiveController.js';

const router = express.Router();

router.get('/',              getAllTimeIncentives);
router.get('/:id',           getTimeIncentiveById);
router.post('/',             createTimeIncentive);
router.put('/:id',           updateTimeIncentive);
router.patch('/:id/status',  toggleTimeIncentiveStatus);
router.delete('/:id',        deleteTimeIncentive);

export default router;
