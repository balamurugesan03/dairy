import express from 'express';
import multer from 'multer';
import os from 'os';
import {
  createSlip,
  getAllSlips,
  getSlipById,
  updateSlip,
  deleteSlip,
  bulkImportSlips,
  fileUploadImportSlips,
  zibittRawImportSlips,
  backfillVouchers,
} from '../controllers/unionSalesSlipController.js';

const router = express.Router();

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

// Import routes — before /:id
router.post('/file-import',      upload.single('file'), fileUploadImportSlips);
router.post('/bulk-import',      bulkImportSlips);
router.post('/zibitt-raw-import', zibittRawImportSlips);

// Backfill missing Day Book vouchers for legacy slips — before /:id
router.post('/backfill-vouchers', backfillVouchers);

// Main CRUD
router.post('/',      createSlip);
router.get('/',       getAllSlips);
router.get('/:id',    getSlipById);
router.put('/:id',    updateSlip);
router.delete('/:id', deleteSlip);

export default router;
