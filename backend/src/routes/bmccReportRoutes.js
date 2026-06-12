import express from 'express';
import {
  getMonthlySummary,
  getReport,
  saveReport,
  updateReport,
  deleteReport,
} from '../controllers/bmccReportController.js';

const router = express.Router();

router.get('/monthly-summary', getMonthlySummary);
router.get('/report',          getReport);
router.post('/save',           saveReport);
router.put('/update/:id',      updateReport);
router.delete('/delete/:id',   deleteReport);

export default router;
