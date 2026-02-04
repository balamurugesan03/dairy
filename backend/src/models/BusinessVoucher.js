import mongoose from 'mongoose';

const businessVoucherSchema = new mongoose.Schema({
  voucherNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  voucherType: {
    type: String,
    required: true,
    enum: ['Income', 'Expense', 'Journal', 'Contra', 'Sales', 'Purchase']
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  entries: [{
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BusinessLedger',
      required: true
    },
    ledgerName: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['debit', 'credit'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: String
  }],
  totalDebit: {
    type: Number,
    default: 0
  },
  totalCredit: {
    type: Number,
    default: 0
  },
  narration: {
    type: String,
    trim: true
  },
  // Payment/Receipt details
  paymentMode: {
    type: String,
    enum: ['Cash', 'Bank', 'UPI', 'Card', 'Cheque'],
    default: 'Cash'
  },
  bankName: String,
  chequeNumber: String,
  chequeDate: Date,
  transactionId: String,
  // Reference
  referenceType: {
    type: String,
    enum: ['BusinessSales', 'BusinessPurchase', 'Manual', 'Opening']
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceNumber: String,
  // Party details
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  partyName: String,
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Cancelled'],
    default: 'Posted'
  },
  businessType: {
    type: String,
    default: 'Private Firm'
  }
}, {
  timestamps: true
});

// Indexes
businessVoucherSchema.index({ date: -1 });
businessVoucherSchema.index({ voucherType: 1 });
businessVoucherSchema.index({ voucherNumber: 1 });
businessVoucherSchema.index({ status: 1 });

const BusinessVoucher = mongoose.model('BusinessVoucher', businessVoucherSchema);

export default BusinessVoucher;
