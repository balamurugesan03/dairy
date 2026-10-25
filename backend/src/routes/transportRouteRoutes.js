import express from 'express';
import {
  getTransportRoutes,
  getTransportRouteById,
  createTransportRoute,
  updateTransportRoute,
  deleteTransportRoute,
  getTransportCharges,
  postTransportCharges,
  getTransportBills,
  deleteTransportBill
} from '../controllers/transportRouteController.js';

const router = express.Router();

// GET transport charges for a period (query: fromDate, toDate, routeId?)
router.get('/charges', getTransportCharges);

// Ledger posting of transport charges
router.post('/charges/post', postTransportCharges);
router.get('/bills', getTransportBills);
router.delete('/bills/:id', deleteTransportBill);

router.get('/', getTransportRoutes);
router.get('/:id', getTransportRouteById);
router.post('/', createTransportRoute);
router.put('/:id', updateTransportRoute);
router.delete('/:id', deleteTransportRoute);

export default router;
