import express from 'express';
import {
  getInspectionReport,
  saveInspectionReport,
  updateInspectionReport,
} from '../controllers/inspectionReportController.js';

const router = express.Router();

router.get('/',    getInspectionReport);
router.post('/',   saveInspectionReport);
router.put('/:id', updateInspectionReport);

export default router;
