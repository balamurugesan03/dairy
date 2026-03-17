import express from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  searchSupplier,
  getSupplierBySupplierId,
  getNextSupplierId
} from '../controllers/supplierController.js';
import { protect, addCompanyFilter } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, addCompanyFilter);

// Create new supplier
router.post('/', createSupplier);

// Get all suppliers
router.get('/', getAllSuppliers);

// Get next supplier ID (auto-generate)
router.get('/next-id', getNextSupplierId);

// Search supplier by supplierId, name, or phone
router.get('/search', searchSupplier);

// Get supplier by supplierId
router.get('/supplierId/:supplierId', getSupplierBySupplierId);

// Get supplier by ID
router.get('/:id', getSupplierById);

// Update supplier
router.put('/:id', updateSupplier);

// Delete/Deactivate supplier
router.delete('/:id', deleteSupplier);

export default router;
