import express from 'express';
import {
  createBusinessCustomer,
  getAllBusinessCustomers,
  getBusinessCustomerById,
  updateBusinessCustomer,
  deleteBusinessCustomer,
  searchBusinessCustomer
} from '../controllers/businessCustomerController.js';

const router = express.Router();

router.post('/', createBusinessCustomer);
router.get('/', getAllBusinessCustomers);
router.get('/search', searchBusinessCustomer);
router.get('/:id', getBusinessCustomerById);
router.put('/:id', updateBusinessCustomer);
router.delete('/:id', deleteBusinessCustomer);

export default router;
