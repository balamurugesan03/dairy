import express from 'express';
import { getAll, create, toggleStatus, remove } from '../controllers/periodicalRuleController.js';

const router = express.Router();
router.get('/',            getAll);
router.post('/',           create);
router.patch('/:id/status', toggleStatus);
router.delete('/:id',      remove);
export default router;
