import express from 'express';
import multer from 'multer';
import os from 'os';
import {
  createCollection,
  getAllCollections,
  getCollectionById,
  updateCollection,
  deleteCollection,
  bulkDeleteCollections,
  bulkDeleteRecords,
  getDateSummary,
  getFarmerHistory,
  getFarmerStats,
  getFarmerWiseSummary,
  getFarmerWiseStatement,
  getDateWiseSummary,
  bulkImportCollections,
  fileUploadImportCollections,
  zibittBrowserImportCollections,
  linzaImportCollections,
  openLyssaImportCollections,
  dairysoftImportCollections,
  getCentreSummary,
  getDaySummary,
  getFarmerCriteriaSummary,
  getCollectionAnalysis,
  getSocietyReport,
} from '../controllers/milkCollectionController.js';

import { requireSuperAdmin } from '../utils/userTier.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB

// Summary / aggregate routes — BEFORE /:id
router.get('/centre-summary',              getCentreSummary);
router.get('/day-summary',                 getDaySummary);
router.get('/summary/farmer-criteria',     getFarmerCriteriaSummary);
router.get('/summary/collection-analysis', getCollectionAnalysis);
router.get('/summary/society-report',      getSocietyReport);
router.get('/summary/farmer-wise',         getFarmerWiseSummary);
router.get('/statement/farmer-wise',       getFarmerWiseStatement);
router.get('/summary/date-wise',           getDateWiseSummary);
router.get('/farmer/:farmerNumber/stats',  getFarmerStats);
router.get('/farmer/:farmerNumber',        getFarmerHistory);

// Date summary (for bulk delete date picker)
router.get('/date-summary', getDateSummary);
// Bulk delete (Super Admin only): date+shift slots, or Daily Collection List records (ticked / date range)
router.post('/bulk-delete',         requireSuperAdmin, bulkDeleteCollections);
router.post('/bulk-delete-records', requireSuperAdmin, bulkDeleteRecords);

// Import routes — Super Admin only (Import from Everest DPO, Zibitt, LinZA, OpenLyssa, DairySoft)
router.post('/file-import',      requireSuperAdmin, upload.single('file'), fileUploadImportCollections);
router.post('/bulk-import',      requireSuperAdmin, bulkImportCollections);
router.post('/zibitt-import',    requireSuperAdmin, zibittBrowserImportCollections);
router.post('/linza-import',     requireSuperAdmin, linzaImportCollections);
router.post('/openlyssa-import', requireSuperAdmin, openLyssaImportCollections);
router.post('/dairysoft-import', requireSuperAdmin, dairysoftImportCollections);

// Main CRUD
router.post('/',      createCollection);
router.get('/',       getAllCollections);
router.get('/:id',    getCollectionById);
router.put('/:id',    updateCollection);
router.delete('/:id', deleteCollection);

export default router;
