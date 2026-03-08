import express from 'express';
import {
  createWarranty, getAllWarranties, getWarrantyById, updateWarranty, deleteWarranty,
  addWarrantyClaim, updateWarrantyClaim,
  createMachine, getAllMachines, getMachineById, updateMachine, deleteMachine,
  addMaintenanceLog, updateMaintenanceLog,
  createQuotation, getAllQuotations, getQuotationById, updateQuotation, deleteQuotation,
  convertQuotationToInvoice, sendQuotation,
  createPromotion, getAllPromotions, getPromotionById, updatePromotion, deletePromotion
} from '../controllers/additionalController.js';

const router = express.Router();

// ── Warranty ────────────────────────────────────────────────
router.post('/warranty', createWarranty);
router.get('/warranty', getAllWarranties);
router.get('/warranty/:id', getWarrantyById);
router.put('/warranty/:id', updateWarranty);
router.delete('/warranty/:id', deleteWarranty);
router.post('/warranty/:id/claims', addWarrantyClaim);
router.put('/warranty/:id/claims/:claimId', updateWarrantyClaim);

// ── Machine ─────────────────────────────────────────────────
router.post('/machines', createMachine);
router.get('/machines', getAllMachines);
router.get('/machines/:id', getMachineById);
router.put('/machines/:id', updateMachine);
router.delete('/machines/:id', deleteMachine);
router.post('/machines/:id/maintenance', addMaintenanceLog);
router.put('/machines/:id/maintenance/:logId', updateMaintenanceLog);

// ── Quotation ────────────────────────────────────────────────
router.post('/quotations', createQuotation);
router.get('/quotations', getAllQuotations);
router.get('/quotations/:id', getQuotationById);
router.put('/quotations/:id', updateQuotation);
router.delete('/quotations/:id', deleteQuotation);
router.post('/quotations/:id/convert', convertQuotationToInvoice);
router.post('/quotations/:id/send', sendQuotation);

// ── Promotion ────────────────────────────────────────────────
router.post('/promotions', createPromotion);
router.get('/promotions', getAllPromotions);
router.get('/promotions/:id', getPromotionById);
router.put('/promotions/:id', updatePromotion);
router.delete('/promotions/:id', deletePromotion);

export default router;
