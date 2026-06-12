import express from 'express';
import { getReport, getProducerDetail } from '../controllers/intelligentQueryController.js';

const router = express.Router();

router.get('/',                        getReport);
router.get('/producer/:farmerNumber',  getProducerDetail);

export default router;
