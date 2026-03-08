import express from 'express';
import {
  getSettings,
  upsertSettings,
  resetSettings,
  toggleMachine,
  getSettingsSummary,
} from '../controllers/milkPurchaseSettingsController.js';

const router = express.Router();

// ── Specific routes BEFORE param routes to avoid conflicts ────────────────────

// GET  /api/milk-purchase-settings/summary  → lightweight summary for MilkPurchase screen
router.get('/summary', getSettingsSummary);

// DELETE /api/milk-purchase-settings/reset  → restore factory defaults
router.delete('/reset', resetSettings);

// PATCH /api/milk-purchase-settings/machines/:key  → toggle a single device
// e.g. PATCH /api/milk-purchase-settings/machines/weighingScale  { "enabled": true }
router.patch('/machines/:key', toggleMachine);

// ── Main CRUD ─────────────────────────────────────────────────────────────────

// GET  /api/milk-purchase-settings   → fetch (or auto-create with defaults)
router.get('/', getSettings);

// PUT  /api/milk-purchase-settings   → upsert full or partial settings
router.put('/', upsertSettings);

export default router;
