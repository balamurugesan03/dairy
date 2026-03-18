import mongoose from 'mongoose';

const salesReturnSchema = new mongoose.Schema({
  returnNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  returnDate: {
    type: Date,
    required: true,
    default: Date.now
  },

  // Customer Details
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerAddress: {
    type: String,
    trim: true
  },
  customerGstin: {
    type: String,
    trim: true
  },
  customerState: {
    type: String,
    trim: true
  },

  // Original Invoice Reference
  originalInvoiceRef: {
    type: String,
    trim: true
  },
  originalInvoiceDate: {
    type: Date
  },
  reason: {
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
    unit: {
      type: String,
      trim: true
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

  // Payment Details
  paymentMode: {
    type: String,
    enum: ['Cash', 'Credit', 'Bank', 'UPI', 'Cheque', 'Adjustment'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partial', 'Pending'],
    default: 'Pending'
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

  // Notes & Status
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Cancelled'],
    default: 'Active'
  },

  // Business Reference
  businessType: {
    type: String,
    default: 'Private Firm'
  }
}, {
  timestamps: true
});

// Indexes
salesReturnSchema.index({ returnDate: -1 });
salesReturnSchema.index({ customerId: 1 });
salesReturnSchema.index({ returnNumber: 1, companyId: 1 }, { unique: true, partialFilterExpression: { companyId: { $type: 'objectId' } } });
salesReturnSchema.index({ paymentStatus: 1 });
salesReturnSchema.index({ status: 1 });

const SalesReturn = mongoose.model('SalesReturn', salesReturnSchema);

export default SalesReturn;
