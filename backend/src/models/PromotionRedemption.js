import mongoose from 'mongoose';

const promotionRedemptionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  promotionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessPromotion',
    required: true
  },
  salesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sales'
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  customerName: {
    type: String,
    trim: true
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  orderAmount: {
    type: Number,
    required: true,
    min: 0
  },
  redemptionDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

promotionRedemptionSchema.index({ companyId: 1, promotionId: 1 });
promotionRedemptionSchema.index({ companyId: 1, customerId: 1 });
promotionRedemptionSchema.index({ redemptionDate: -1 });

const PromotionRedemption = mongoose.model('PromotionRedemption', promotionRedemptionSchema);

export default PromotionRedemption;
