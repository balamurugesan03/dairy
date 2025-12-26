import express from 'express';
import {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  searchCustomer,
  getCustomerByCustomerId
} from '../controllers/customerController.js';

const router = express.Router();

// Create new customer
router.post('/', createCustomer);

// Get all customers
router.get('/', getAllCustomers);

// Search customer by customerId, name, or phone
router.get('/search', searchCustomer);

// Get customer by customerId
router.get('/customerId/:customerId', getCustomerByCustomerId);

// Get customer by ID
router.get('/:id', getCustomerById);

// Update customer
router.put('/:id', updateCustomer);

// Delete/Deactivate customer
router.delete('/:id', deleteCustomer);

export default router;
