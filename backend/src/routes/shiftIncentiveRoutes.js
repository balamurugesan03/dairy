import express from 'express';
import {
  getShiftIncentives,
  getShiftIncentiveById,
  getActiveIncentives,
  createShiftIncentive,
  updateShiftIncentive,
  deleteShiftIncentive,
  toggleStatus
} from '../controllers/shiftIncentiveController.js';

const router = express.Router();

// GET /api/shift-incentives              → all (paginated + search + filter)
router.get('/', getShiftIncentives);

// GET /api/shift-incentives/active       → active incentives for billing
// (must be before /:id to avoid conflict)
router.get('/active', getActiveIncentives);

// GET /api/shift-incentives/:id          → single record
router.get('/:id', getShiftIncentiveById);

// POST /api/shift-incentives             → create
router.post('/', createShiftIncentive);

// PUT /api/shift-incentives/:id          → update
router.put('/:id', updateShiftIncentive);

// PATCH /api/shift-incentives/:id/status → toggle active/inactive
router.patch('/:id/status', toggleStatus);

// DELETE /api/shift-incentives/:id       → soft delete (sets inactive)
router.delete('/:id', deleteShiftIncentive);

export default router;
