import express from 'express';
import {
  markAttendance,
  bulkMarkAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
  getAttendanceByDate,
  getMonthlySummary,
  getAttendanceReport
} from '../controllers/attendanceController.js';

const router = express.Router();

router.get('/report', getAttendanceReport);
router.get('/by-date', getAttendanceByDate);
router.get('/:employeeId/summary', getMonthlySummary);
router.post('/bulk', bulkMarkAttendance);
router.post('/', markAttendance);
router.get('/', getAllAttendance);
router.get('/:id', getAttendanceById);
router.put('/:id', updateAttendance);
router.delete('/:id', deleteAttendance);

export default router;
