import express from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  searchSupplier,
  getSupplierBySupplierId
} from '../controllers/supplierController.js';

const router = express.Router();

// Create new supplier
router.post('/', createSupplier);

// Get all suppliers
router.get('/', getAllSuppliers);

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
