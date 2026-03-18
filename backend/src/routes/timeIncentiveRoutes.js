import express from 'express';
import {
  getAllTimeIncentives,
  getTimeIncentiveById,
  getActiveTimeIncentive,
  createTimeIncentive,
  updateTimeIncentive,
  deleteTimeIncentive,
  toggleTimeIncentiveStatus,
} from '../controllers/timeIncentiveController.js';

const router = express.Router();

router.get('/',              getAllTimeIncentives);
router.get('/active',        getActiveTimeIncentive);  // must be before /:id
router.get('/:id',           getTimeIncentiveById);
router.post('/',             createTimeIncentive);
router.put('/:id',           updateTimeIncentive);
router.patch('/:id/status',  toggleTimeIncentiveStatus);
router.delete('/:id',        deleteTimeIncentive);

export default router;
