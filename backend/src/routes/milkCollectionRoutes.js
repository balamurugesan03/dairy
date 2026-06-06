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
  getDateSummary,
  getFarmerHistory,
  getFarmerStats,
  getFarmerWiseSummary,
  getDateWiseSummary,
  bulkImportCollections,
  fileUploadImportCollections,
  zibittBrowserImportCollections,
  linzaImportCollections,
  openLyssaImportCollections,
} from '../controllers/milkCollectionController.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB

// Summary / aggregate routes — BEFORE /:id
router.get('/summary/farmer-wise',         getFarmerWiseSummary);
router.get('/summary/date-wise',           getDateWiseSummary);
router.get('/farmer/:farmerNumber/stats',  getFarmerStats);
router.get('/farmer/:farmerNumber',        getFarmerHistory);

// Date summary (for bulk delete date picker)
router.get('/date-summary', getDateSummary);
// Bulk delete selected date+shift slots
router.post('/bulk-delete', bulkDeleteCollections);

// Import routes
router.post('/file-import',    upload.single('file'), fileUploadImportCollections);
router.post('/bulk-import',    bulkImportCollections);
router.post('/zibitt-import',    zibittBrowserImportCollections);
router.post('/linza-import',     linzaImportCollections);
router.post('/openlyssa-import', openLyssaImportCollections);

// Main CRUD
router.post('/',      createCollection);
router.get('/',       getAllCollections);
router.get('/:id',    getCollectionById);
router.put('/:id',    updateCollection);
router.delete('/:id', deleteCollection);

export default router;
