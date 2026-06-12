import express from 'express';
import {
  getCFAdvanceLedger,
  getCFAdvanceSummary,
  getCFAdvanceRegister,
  getCFFarmers,
} from '../controllers/cattleFeedAdvanceController.js';

const router = express.Router();

router.get('/farmers',  getCFFarmers);          // GET /api/cattle-feed-advance/farmers
router.get('/ledger',   getCFAdvanceLedger);    // GET /api/cattle-feed-advance/ledger?farmerId=&fromDate=&toDate=
router.get('/summary',  getCFAdvanceSummary);   // GET /api/cattle-feed-advance/summary?fromDate=&toDate=
router.get('/register', getCFAdvanceRegister);  // GET /api/cattle-feed-advance/register?fromDate=&toDate=

export default router;
