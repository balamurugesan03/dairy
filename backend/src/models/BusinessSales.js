import mongoose from 'mongoose';

const businessSalesSchema = new mongoose.Schema({
  // Invoice Details
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  invoiceType: {
    type: String,
    enum: ['Sale', 'Sale Return', 'Estimate', 'Delivery Challan', 'Proforma'],
    default: 'Sale'
  },

  // Party/Customer Details
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  partyName: {
    type: String,
    trim: true
  },
  partyPhone: {
    type: String,
    trim: true
  },
  partyAddress: {
    type: String,
    trim: true
  },
  partyGstin: {
    type: String,
    trim: true
  },
  partyState: {
    type: String,
    trim: true
  },

  // Items
  items: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessItem',
      required: true
    },
    itemCode: {
      type: String,
      trim: true
    },
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    hsnCode: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    freeQty: {
      type: Number,
      default: 0,
      min: 0
    },
    unit: {
      type: String,
      trim: true
    },
    mrp: {
      type: Number,
      default: 0,
      min: 0
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    gstPercent: {
      type: Number,
      default: 0,
      min: 0
    },
    cgstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    sgstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    igstAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    }
  }],

  // Bill Summary
  totalQty: {
    type: Number,
    default: 0,
    min: 0
  },
  grossAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  itemDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  billDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  billDiscountPercent: {
    type: Number,
    default: 0,
    min: 0
  },
  taxableAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCgst: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSgst: {
    type: Number,
    default: 0,
    min: 0
  },
  totalIgst: {
    type: Number,
    default: 0,
    min: 0
  },
  totalGst: {
    type: Number,
    default: 0,
    min: 0
  },
  roundOff: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },

  // Previous Balance
  previousBalance: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },

  // Payment Details
  paymentMode: {
    type: String,
    enum: ['Cash', 'Credit', 'Bank', 'UPI', 'Card', 'Cheque'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partial', 'Unpaid'],
    default: 'Unpaid'
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

  // Bank/Cheque Details
  bankName: {
    type: String,
    trim: true
  },
  chequeNumber: {
    type: String,
    trim: true
  },
  chequeDate: {
    type: Date
  },
  transactionId: {
    type: String,
    trim: true
  },

  // Additional Details
  poNumber: {
    type: String,
    trim: true
  },
  poDate: {
    type: Date
  },
  ewaybillNumber: {
    type: String,
    trim: true
  },
  vehicleNumber: {
    type: String,
    trim: true
  },
  transportName: {
    type: String,
    trim: true
  },
  lrNumber: {
    type: String,
    trim: true
  },

  // Notes & Terms
  notes: {
    type: String,
    trim: true
  },
  termsAndConditions: {
    type: String,
    trim: true
  },

  // Accounting Integration
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  ledgerEntries: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  }],

  // Business Reference
  businessType: {
    type: String,
    default: 'Private Firm'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
businessSalesSchema.index({ invoiceDate: -1 });
businessSalesSchema.index({ partyId: 1 });
businessSalesSchema.index({ invoiceNumber: 1 });
businessSalesSchema.index({ paymentStatus: 1 });
businessSalesSchema.index({ invoiceType: 1 });

const BusinessSales = mongoose.model('BusinessSales', businessSalesSchema);

export default BusinessSales;
