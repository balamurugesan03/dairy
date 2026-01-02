import express from 'express';
import {
  getAllSubsidies,
  createSubsidy,
  getSubsidyById,
  updateSubsidy,
  deleteSubsidy
} from '../controllers/subsidyController.js';

const router = express.Router();

// Subsidy routes
router.get('/subsidies', getAllSubsidies);
router.post('/subsidies', createSubsidy);
router.get('/subsidies/:id', getSubsidyById);
router.put('/subsidies/:id', updateSubsidy);
router.delete('/subsidies/:id', deleteSubsidy);

export default router;
