import express from 'express';
import {
  getAll,
  getActive,
  getById,
  create,
  update,
  toggleStatus,
  remove,
  bulkUpdateSettings,
} from '../controllers/earningDeductionController.js';

const router = express.Router();

// GET /api/earning-deductions          → all (paginated + search + filter)
router.get('/', getAll);

// GET /api/earning-deductions/active   → active records for dropdowns (before /:id)
router.get('/active', getActive);

// GET /api/earning-deductions/:id      → single record
router.get('/:id', getById);

// POST /api/earning-deductions         → create
router.post('/', create);

// PUT /api/earning-deductions/:id      → update
router.put('/:id', update);

// PATCH /api/earning-deductions/:id/status → toggle active/inactive
router.patch('/:id/status', toggleStatus);

// DELETE /api/earning-deductions/:id   → delete
router.delete('/:id', remove);

// PUT /api/earning-deductions/settings/bulk → bulk update periodical settings
router.put('/settings/bulk', bulkUpdateSettings);

export default router;
