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
  getUnionSalesReport,
} from '../controllers/unionSalesSlipController.js';
import {
  getUnionSaleSettings,
  saveUnionSaleSettings,
  getToDairyRate,
  applyFromDairyRate,
  deleteFromDairyRate,
  syncFromDairyEntries,
  getQualityComparison,
} from '../controllers/unionSaleQualityController.js';

const router = express.Router();

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } });

// Import routes — before /:id
router.post('/file-import',      upload.single('file'), fileUploadImportSlips);
router.post('/bulk-import',      bulkImportSlips);
router.post('/zibitt-raw-import', zibittRawImportSlips);

// Backfill missing Day Book vouchers for legacy slips — before /:id
router.post('/backfill-vouchers', backfillVouchers);

// Report — before /:id
router.get('/report', getUnionSalesReport);

// Union Sale Quality Comparison (procurement vs To Dairy) — before /:id
router.get('/quality-comparison', getQualityComparison);

// Settings: From Dairy / To Dairy TS Rate Settings — before /:id
router.get('/settings',                  getUnionSaleSettings);
router.put('/settings',                  saveUnionSaleSettings);
router.get('/settings/to-dairy-rate',    getToDairyRate);
// From Dairy TS rates — own periods, separate from the Milk Purchase TS rate
router.post('/settings/from-dairy-rates',           applyFromDairyRate);
router.delete('/settings/from-dairy-rates/:rateId', deleteFromDairyRate);
// Generate / refresh the automatic From Dairy Union Sales entries from the purchase data
router.post('/settings/from-dairy-sync',            syncFromDairyEntries);

// Main CRUD
router.post('/',      createSlip);
router.get('/',       getAllSlips);
router.get('/:id',    getSlipById);
router.put('/:id',    updateSlip);
router.delete('/:id', deleteSlip);

export default router;
