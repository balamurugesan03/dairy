import express from 'express';
import {
  createWarranty, getAllWarranties, getWarrantyById, updateWarranty, deleteWarranty,
  createMachine, getAllMachines, getMachineById, updateMachine, deleteMachine,
  createQuotation, getAllQuotations, getQuotationById, updateQuotation, deleteQuotation,
  createPromotion, getAllPromotions, getPromotionById, updatePromotion, deletePromotion
} from '../controllers/additionalController.js';

const router = express.Router();

// Warranty routes
router.post('/warranty', createWarranty);
router.get('/warranty', getAllWarranties);
router.get('/warranty/:id', getWarrantyById);
router.put('/warranty/:id', updateWarranty);
router.delete('/warranty/:id', deleteWarranty);

// Machine routes
router.post('/machines', createMachine);
router.get('/machines', getAllMachines);
router.get('/machines/:id', getMachineById);
router.put('/machines/:id', updateMachine);
router.delete('/machines/:id', deleteMachine);

// Quotation routes
router.post('/quotations', createQuotation);
router.get('/quotations', getAllQuotations);
router.get('/quotations/:id', getQuotationById);
router.put('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);

// Promotion routes
router.post('/promotions', createPromotion);
router.get('/promotions', getAllPromotions);
router.get('/promotions/:id', getPromotionById);
router.put('/promotions/:id', updatePromotion);
router.delete('/promotions/:id', deletePromotion);

export default router;
