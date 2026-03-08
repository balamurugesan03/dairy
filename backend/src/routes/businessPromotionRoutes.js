import express from 'express';
import {
  createPromotion,
  getAllPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  validateCoupon,
  redeemPromotion,
  getPromotionAnalytics,
  getPromotionRedemptions,
  createTemplate,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  previewTemplate
} from '../controllers/businessPromotionController.js';

const router = express.Router();

// Analytics (before :id to avoid conflict)
router.get('/analytics', getPromotionAnalytics);

// Coupon validation & redemption
router.post('/validate-coupon', validateCoupon);
router.post('/redeem', redeemPromotion);

// Template routes (before :id to avoid conflict)
router.post('/templates', createTemplate);
router.get('/templates', getAllTemplates);
router.get('/templates/:id', getTemplateById);
router.put('/templates/:id', updateTemplate);
router.delete('/templates/:id', deleteTemplate);
router.post('/templates/:id/preview', previewTemplate);

// Promotion CRUD
router.post('/', createPromotion);
router.get('/', getAllPromotions);
router.get('/:id', getPromotionById);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);

// Promotion redemptions
router.get('/:id/redemptions', getPromotionRedemptions);

export default router;
