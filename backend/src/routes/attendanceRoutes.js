import express from 'express';
import {
  markAttendance,
  updateAttendance,
  getAttendanceById,
  getAllAttendance,
  getAttendanceByDate,
  getMonthlyAttendanceSummary,
  getAttendanceReport,
  bulkMarkAttendance,
  deleteAttendance
} from '../controllers/attendanceController.js';

const router = express.Router();

// Reports
router.get('/report', getAttendanceReport);
router.get('/by-date', getAttendanceByDate);
router.get('/:employeeId/summary', getMonthlyAttendanceSummary);

// Bulk operations
router.post('/bulk', bulkMarkAttendance);

// CRUD operations
router.post('/', markAttendance);
router.get('/', getAllAttendance);
router.get('/:id', getAttendanceById);
router.put('/:id', updateAttendance);
router.delete('/:id', deleteAttendance);

export default router;
