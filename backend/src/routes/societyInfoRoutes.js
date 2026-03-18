import express from 'express';
import {
  getSocietyInfo,
  upsertSocietyInfo,
  upsertDocument,
  deleteDocument,
} from '../controllers/societyInfoController.js';

const router = express.Router();

router.get('/',                          getSocietyInfo);
router.put('/',                          upsertSocietyInfo);
router.put('/documents/:documentKey',    upsertDocument);
router.delete('/documents/:documentKey', deleteDocument);

export default router;
