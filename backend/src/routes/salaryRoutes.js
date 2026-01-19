import express from 'express';
import {
  createSalary,
  processSalary,
  getAllSalaries,
  getSalaryById,
  updateSalary,
  approveSalary,
  markSalaryAsPaid,
  generatePayslip,
  getPendingSalaries,
  getUnpaidSalaries,
  bulkProcessSalary,
  deleteSalary
} from '../controllers/salaryController.js';

const router = express.Router();

// Special operations
router.post('/process', processSalary);
router.post('/bulk-process', bulkProcessSalary);
router.get('/pending', getPendingSalaries);
router.get('/unpaid', getUnpaidSalaries);
router.patch('/:id/approve', approveSalary);
router.patch('/:id/mark-paid', markSalaryAsPaid);
router.patch('/:id/generate-payslip', generatePayslip);

// CRUD operations
router.post('/', createSalary);
router.get('/', getAllSalaries);
router.get('/:id', getSalaryById);
router.put('/:id', updateSalary);
router.delete('/:id', deleteSalary);

export default router;
