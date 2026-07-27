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
} from '../controllers/bonusRegisterController.js';

const router = express.Router();

// GET /api/bonus-register/generate       → compute preview rows (no save)
router.get('/generate', generatePreview);

// GET /api/bonus-register/bank-ledgers   → Bank-type ledgers for the Post to Daybook select
router.get('/bank-ledgers', getBankLedgers);

// GET /api/bonus-register                → paginated list
router.get('/', getAll);

// GET /api/bonus-register/:id            → single record
router.get('/:id', getById);

// POST /api/bonus-register               → save as Draft
router.post('/', createRegister);

// PUT /api/bonus-register/:id            → update (Draft only)
router.put('/:id', updateRegister);

// DELETE /api/bonus-register/:id         → delete (blocked if posted)
router.delete('/:id', deleteRegister);

// POST /api/bonus-register/:id/post-to-daybook
router.post('/:id/post-to-daybook', postToDaybook);

// POST /api/bonus-register/:id/cancel-posting
router.post('/:id/cancel-posting', cancelPosting);

export default router;
