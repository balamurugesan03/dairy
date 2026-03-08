import express from 'express';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  searchEmployees,
  getEmployeeStatistics
} from '../controllers/employeeController.js';

const router = express.Router();

router.get('/statistics', getEmployeeStatistics);
router.get('/search', searchEmployees);
router.post('/', createEmployee);
router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);
router.patch('/:id/status', updateEmployeeStatus);

export default router;
