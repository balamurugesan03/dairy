import express from 'express';
import {
  createBusinessSupplier,
  getAllBusinessSuppliers,
  getBusinessSupplierById,
  updateBusinessSupplier,
  deleteBusinessSupplier,
  searchBusinessSupplier,
  getNextBusinessSupplierId
} from '../controllers/businessSupplierController.js';

const router = express.Router();

router.get('/next-id', getNextBusinessSupplierId);
router.get('/search', searchBusinessSupplier);
router.get('/', getAllBusinessSuppliers);
router.post('/', createBusinessSupplier);
router.get('/:id', getBusinessSupplierById);
router.put('/:id', updateBusinessSupplier);
router.delete('/:id', deleteBusinessSupplier);

export default router;
