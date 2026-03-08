import mongoose from 'mongoose';

const promotionTemplateSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  channel: {
    type: String,
    enum: ['WhatsApp', 'SMS', 'Both'],
    default: 'WhatsApp'
  },
  category: {
    type: String,
    enum: ['Coupon', 'Offer', 'Festival', 'Reminder', 'Welcome', 'Custom'],
    default: 'Custom'
  },
  messageBody: {
    type: String,
    required: true
  },
  placeholders: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

promotionTemplateSchema.index({ companyId: 1 });

const PromotionTemplate = mongoose.model('PromotionTemplate', promotionTemplateSchema);

export default PromotionTemplate;
