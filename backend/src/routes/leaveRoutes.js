import express from 'express';
import {
  applyLeave,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  deleteLeave,
  getLeaveSummary
} from '../controllers/leaveController.js';

const router = express.Router();

router.post('/', applyLeave);
router.get('/', getAllLeaves);
router.get('/:employeeId/summary', getLeaveSummary);
router.get('/:id', getLeaveById);
router.patch('/:id/approve', approveLeave);
router.patch('/:id/reject', rejectLeave);
router.delete('/:id', deleteLeave);

export default router;
