import express from 'express';
import {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
} from '../controllers/agriStatsController.js';

const router = express.Router();

router.get('/',       getAllReports);
router.get('/:id',    getReportById);
router.post('/',      createReport);
router.put('/:id',    updateReport);
router.delete('/:id', deleteReport);

export default router;
