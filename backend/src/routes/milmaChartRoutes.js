import express from 'express';
import multer from 'multer';
import {
  uploadMilmaChart,
  adminGetMasters,
  adminGetDetail,
  adminDeleteCharts,
  getMasters,
  lookupRate,
  getDetail,
  createVersion,
  uploadOwnChart,
  deleteVersion,
} from '../controllers/milmaChartController.js';

// In-memory storage — we only need the buffer to parse, not save to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Super-admin router (mounted at /api/milma-charts/admin — protect only) ──
export const adminRouter = express.Router();
adminRouter.post('/upload',              upload.single('file'), uploadMilmaChart);
adminRouter.get('/:companyId/masters',  adminGetMasters);
adminRouter.get('/:companyId/detail',   adminGetDetail);
adminRouter.delete('/:companyId',       adminDeleteCharts);

// ── Company-user router (mounted at /api/milma-charts — protect + companyFilter)
export const userRouter = express.Router();
userRouter.get('/masters', getMasters);
userRouter.post('/lookup', lookupRate);
// Society's own chart versions (imported versions stay read-only)
userRouter.get('/detail', getDetail);
userRouter.post('/versions', createVersion);
userRouter.post('/upload', upload.single('file'), uploadOwnChart);
userRouter.delete('/versions/:chartId', deleteVersion);

// Default export keeps backward compat (not used)
export default userRouter;
