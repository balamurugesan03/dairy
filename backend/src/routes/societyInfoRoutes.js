import express from 'express';
import {
  getSocietyInfo,
  getSocietyBranding,
  upsertSocietyInfo,
  upsertDocument,
  deleteDocument,
} from '../controllers/societyInfoController.js';

const router = express.Router();

router.get('/',                          getSocietyInfo);
router.get('/branding',                  getSocietyBranding);
router.put('/',                          upsertSocietyInfo);
router.put('/documents/:documentKey',    upsertDocument);
router.delete('/documents/:documentKey', deleteDocument);

export default router;
