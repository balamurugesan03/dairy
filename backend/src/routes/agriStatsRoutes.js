import express from 'express';
import {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport
} from '../controllers/agriStatsController.js';
import { getAgriPrefill } from '../controllers/farmerFormController.js';

const router = express.Router();

router.get('/',       getAllReports);
// Figures from Farmer Management + milk purchase for one Panchayat / month (before /:id)
router.get('/prefill', getAgriPrefill);
router.get('/:id',    getReportById);
router.post('/',      createReport);
router.put('/:id',    updateReport);
router.delete('/:id', deleteReport);

export default router;
