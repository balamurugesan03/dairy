import express from 'express';
import {
  getFinancialYears,
  getActiveFinancialYear,
  checkFrozenDate,
  createFinancialYear,
  updateFinancialYear,
  closeFinancialYear,
  toggleFreeze,
  activateFinancialYear,
  deleteFinancialYear
} from '../controllers/financialYearController.js';

const router = express.Router();

router.get('/',          getFinancialYears);
router.get('/active',    getActiveFinancialYear);
router.get('/check-frozen', checkFrozenDate);
router.post('/',         createFinancialYear);
router.put('/:id',       updateFinancialYear);
router.post('/:id/close',    closeFinancialYear);
router.post('/:id/activate', activateFinancialYear);
router.post('/:id/toggle-freeze', toggleFreeze);
router.delete('/:id',    deleteFinancialYear);

export default router;
