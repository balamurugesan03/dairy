import mongoose from 'mongoose';

const salesSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    trim: true
  },
  billDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  customerType: {
    type: String,
    enum: ['Farmer', 'Customer', 'Other'],
    default: 'Other'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'customerModel'
  },
  customerModel: {
    type: String,
    enum: ['Farmer', 'Customer']
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    gstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    subsidyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subsidy'
    },
    subsidyAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
  totalSubsidy: {
    type: Number,
    default: 0,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  totalGst: {
    type: Number,
    default: 0,
    min: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },
  oldBalance: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  collectionCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  subsidyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subsidy'
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'Credit', 'Bank', 'Card', 'UPI'],
    default: 'Cash'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  couponCode: {
    type: String,
    trim: true
  },
  promotionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessPromotion'
  },
  promotionDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  ledgerEntries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  }],
  status: {
    type: String,
    enum: ['Paid', 'Partial', 'Pending'],
    default: 'Pending'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
salesSchema.index({ billDate: -1 });
salesSchema.index({ customerId: 1 });
salesSchema.index({ status: 1 });
salesSchema.index({ companyId: 1 });
salesSchema.index({ billNumber: 1, companyId: 1 }, { unique: true });

const Sales = mongoose.model('Sales', salesSchema);

export default Sales;
