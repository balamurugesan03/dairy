import express from 'express';
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  searchEmployees,
  getEmployeeStatistics,
  updateEmployeeStatus
} from '../controllers/employeeController.js';

const router = express.Router();

// Statistics
router.get('/statistics', getEmployeeStatistics);

// Search
router.get('/search', searchEmployees);

// CRUD operations
router.post('/', createEmployee);
router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.put('/:id', updateEmployee);
router.delete('/:id', deleteEmployee);

// Status update
router.patch('/:id/status', updateEmployeeStatus);

export default router;
