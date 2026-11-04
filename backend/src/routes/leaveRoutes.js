import express from 'express';
import {
  applyLeave,
  getAllLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  cancelLeave,
  deleteLeave,
  getLeaveSummary,
  getLeaveBalanceForEmployee
} from '../controllers/leaveController.js';

const router = express.Router();

router.post('/', applyLeave);
router.get('/', getAllLeaves);
router.get('/balance/:employeeId', getLeaveBalanceForEmployee);
router.get('/:employeeId/summary', getLeaveSummary);
router.get('/:id', getLeaveById);
router.patch('/:id/approve', approveLeave);
router.patch('/:id/reject', rejectLeave);
router.patch('/:id/cancel', cancelLeave);
router.delete('/:id', deleteLeave);

export default router;
