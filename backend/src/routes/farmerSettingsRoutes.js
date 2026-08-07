import express from 'express';
import { getSettings, upsertSettings } from '../controllers/farmerSettingsController.js';

const router = express.Router();

// GET /api/farmer-settings   → fetch (or auto-create with defaults)
router.get('/', getSettings);

// PUT /api/farmer-settings   → upsert (e.g. { membershipFunction: 'SubmitLinks' })
router.put('/', upsertSettings);

export default router;
