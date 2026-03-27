import express from 'express';
import { getSettings, upsertSettings } from '../controllers/dairySettingsController.js';

const router = express.Router();

router.get('/', getSettings);
router.put('/', upsertSettings);

export default router;
