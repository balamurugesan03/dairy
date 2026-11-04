import express from 'express';
import {
  createSalary,
  processSalary,
  bulkProcessSalary,
  previewSalary,
  getAllSalaries,
  getSalaryById,
  updateSalary,
  deleteSalary,
  approveSalary,
  bulkApproveSalary,
  markSalaryPaid,
  bulkPaySalary,
  revertSalaryPaid,
  generatePayslip,
  getPendingSalaries,
  getUnpaidSalaries
} from '../controllers/salaryController.js';

const router = express.Router();

router.get('/pending', getPendingSalaries);
router.get('/unpaid', getUnpaidSalaries);
router.post('/preview', previewSalary);
router.post('/process', processSalary);
router.post('/bulk-process', bulkProcessSalary);
router.post('/bulk-approve', bulkApproveSalary);
router.post('/bulk-pay', bulkPaySalary);
router.post('/', createSalary);
router.get('/', getAllSalaries);
router.get('/:id', getSalaryById);
router.put('/:id', updateSalary);
router.delete('/:id', deleteSalary);
router.patch('/:id/approve', approveSalary);
router.patch('/:id/mark-paid', markSalaryPaid);
router.patch('/:id/revert-payment', revertSalaryPaid);
router.patch('/:id/generate-payslip', generatePayslip);

export default router;
