import express from 'express';
import {
  generatePreview,
  createRegister,
  updateRegister,
  getAll,
  getById,
  deleteRegister,
  postToDaybook,
  cancelPosting,
  getBankLedgers,
} from '../controllers/incentiveRegisterController.js';

const router = express.Router();

// GET /api/incentive-register/generate       → compute preview rows (no save)
router.get('/generate', generatePreview);

// GET /api/incentive-register/bank-ledgers   → Bank-type ledgers for the Post to Daybook select
router.get('/bank-ledgers', getBankLedgers);

// GET /api/incentive-register                → paginated list
router.get('/', getAll);

// GET /api/incentive-register/:id            → single record
router.get('/:id', getById);

// POST /api/incentive-register               → save as Draft
router.post('/', createRegister);

// PUT /api/incentive-register/:id            → update (Draft only)
router.put('/:id', updateRegister);

// DELETE /api/incentive-register/:id         → delete (blocked if posted)
router.delete('/:id', deleteRegister);

// POST /api/incentive-register/:id/post-to-daybook
router.post('/:id/post-to-daybook', postToDaybook);

// POST /api/incentive-register/:id/cancel-posting
router.post('/:id/cancel-posting', cancelPosting);

export default router;
