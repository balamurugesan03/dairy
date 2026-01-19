import express from 'express';
import {
  applyLeave,
  getAllLeaves,
  getLeaveById,
  updateLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getPendingLeaves,
  getLeaveSummary,
  getUpcomingLeaves,
  deleteLeave
} from '../controllers/leaveController.js';

const router = express.Router();

// Special operations
router.get('/pending', getPendingLeaves);
router.get('/upcoming', getUpcomingLeaves);
router.get('/:employeeId/summary', getLeaveSummary);
router.patch('/:id/approve', approveLeave);
router.patch('/:id/reject', rejectLeave);
router.patch('/:id/cancel', cancelLeave);

// CRUD operations
router.post('/', applyLeave);
router.get('/', getAllLeaves);
router.get('/:id', getLeaveById);
router.put('/:id', updateLeave);
router.delete('/:id', deleteLeave);

export default router;
