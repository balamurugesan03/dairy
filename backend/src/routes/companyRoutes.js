import express from 'express';
import {
  createCompany,
  getAllCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getCompanyStats
} from '../controllers/companyController.js';

const router = express.Router();

// Company CRUD routes
router.post('/', createCompany);
router.get('/', getAllCompanies);
router.get('/stats', getCompanyStats);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.delete('/:id', deleteCompany);

export default router;
