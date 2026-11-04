import express from 'express';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  getEmployeeProfile,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  searchEmployees,
  getEmployeeStatistics,
  getNextCode
} from '../controllers/employeeController.js';

const router = express.Router();

router.get('/statistics', getEmployeeStatistics);
router.get('/search', searchEmployees);
router.get('/next-code', getNextCode);
router.post('/', createEmployee);
router.get('/', getAllEmployees);
router.get('/:id/profile', getEmployeeProfile);
router.get('/:id', getEmployeeById);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);
router.patch('/:id/status', updateEmployeeStatus);

export default router;
