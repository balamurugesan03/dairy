import mongoose from 'mongoose';

const businessPromotionSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  promotionType: {
    type: String,
    enum: ['Coupon', 'Offer', 'Campaign'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Paused', 'Expired', 'Completed'],
    default: 'Draft'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  targetType: {
    type: String,
    enum: ['All', 'Specific', 'Group'],
    default: 'All'
  },
  targetCustomers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  }],
  targetGroup: {
    type: String,
    trim: true
  },
  applicableTo: {
    type: String,
    enum: ['All Items', 'Specific Items', 'Specific Categories'],
    default: 'All Items'
  },
  applicableItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessItem'
  }],
  applicableCategories: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Coupon-specific fields
  couponCode: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true
  },
  discountType: {
    type: String,
    enum: ['Percentage', 'Flat']
  },
  discountValue: {
    type: Number,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  minOrderAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  usageLimit: {
    type: Number,
    min: 0,
    default: 0
  },
  usageLimitPerCustomer: {
    type: Number,
    min: 0,
    default: 0
  },
  currentUsageCount: {
    type: Number,
    default: 0
  },

  // Offer-specific fields
  offerType: {
    type: String,
    enum: ['Buy X Get Y', 'Percentage Discount', 'Flat Discount', 'Free Item']
  },
  buyQuantity: {
    type: Number,
    min: 0
  },
  getQuantity: {
    type: Number,
    min: 0
  },
  getItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessItem'
  },
  getItemName: {
    type: String,
    trim: true
  },

  // Campaign-specific fields
  campaignType: {
    type: String,
    enum: ['Seasonal', 'Clearance', 'Launch', 'Festival', 'Custom']
  },
  budget: {
    type: Number,
    min: 0,
    default: 0
  },
  spentAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  linkedPromotions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessPromotion'
  }],
  notes: {
    type: String,
    trim: true
  },

  // Analytics fields
  totalRedemptions: {
    type: Number,
    default: 0
  },
  totalRevenueGenerated: {
    type: Number,
    default: 0
  },
  totalDiscountGiven: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

businessPromotionSchema.index({ companyId: 1, promotionType: 1 });
businessPromotionSchema.index({ companyId: 1, status: 1 });
businessPromotionSchema.index({ couponCode: 1, companyId: 1 }, { unique: true, sparse: true });
businessPromotionSchema.index({ startDate: 1, endDate: 1 });

const BusinessPromotion = mongoose.model('BusinessPromotion', businessPromotionSchema);

export default BusinessPromotion;
