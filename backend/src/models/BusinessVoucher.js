import mongoose from 'mongoose';

const businessVoucherSchema = new mongoose.Schema({
  voucherNumber: {
    type: String,
    required: true,
    trim: true
  },
  voucherType: {
    type: String,
    required: true,
    enum: [
      // Standard
      'Receipt', 'Payment', 'Journal', 'Contra',
      // Legacy (kept for backward compat)
      'Income', 'Expense',
      // Trade
      'Sales', 'Purchase', 'CreditNote', 'DebitNote',
      // Farmer-related
      'FarmerPayment', 'LoanDisbursal', 'AdvancePayment', 'BulkBankTransfer',
      // Tax
      'GSTPayment', 'TDSPayment',
      // Period-end
      'OpeningBalance'
    ]
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  financialYear: {
    type: String,
    trim: true
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
    // 'debit' or 'credit' (lowercase — consistent throughout business module)
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
    // GST metadata on GST lines
    isGSTLine: { type: Boolean, default: false },
    gstComponent: { type: String, enum: ['CGST', 'SGST', 'IGST', 'Cess', null] },
    gstRate: Number,
    hsnCode: String,
    // Stock metadata on COGS/Stock lines
    isStockLine: { type: Boolean, default: false },
    itemId: mongoose.Schema.Types.ObjectId,
    itemName: String,
    quantity: Number,
    unitCost: Number,
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
  // Reference linkage
  referenceType: {
    type: String,
    enum: [
      'BusinessSales', 'BusinessPurchase', 'Manual', 'Opening',
      'MilkPurchase', 'MilkSales', 'FarmerPayment',
      'LoanDisbursal', 'AdvancePayment', 'GSTPayment', 'TDSPayment'
    ]
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceNumber: String,
  // For CreditNote / DebitNote — link to original invoice
  originalVoucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessVoucher'
  },
  originalVoucherNumber: String,
  // Party details
  partyId: {
    type: mongoose.Schema.Types.ObjectId
  },
  partyName: String,
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Cancelled'],
    default: 'Posted'
  },
  // Cancellation trail
  cancelledVoucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessVoucher'
  },
  cancelledAt: Date,
  cancelledBy: mongoose.Schema.Types.ObjectId,
  cancelReason: String,
  businessType: {
    type: String,
    default: 'Private Firm'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
businessVoucherSchema.index({ companyId: 1, date: -1 });
businessVoucherSchema.index({ companyId: 1, voucherType: 1, date: -1 });
businessVoucherSchema.index({ companyId: 1, status: 1 });
businessVoucherSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
businessVoucherSchema.index({ voucherNumber: 1, companyId: 1 }, { unique: true });
businessVoucherSchema.index({ companyId: 1, 'entries.ledgerId': 1, date: 1 });

// Pre-save: validate balance + compute totals + set financialYear
businessVoucherSchema.pre('save', async function() {
  if (this.entries && this.entries.length > 0) {
    const totalDr = this.entries
      .filter(e => e.type === 'debit')
      .reduce((s, e) => s + e.amount, 0);
    const totalCr = this.entries
      .filter(e => e.type === 'credit')
      .reduce((s, e) => s + e.amount, 0);

    if (Math.abs(totalDr - totalCr) > 0.01) {
      throw new Error(
        `Voucher imbalanced: Debit=${totalDr.toFixed(2)} Credit=${totalCr.toFixed(2)}`
      );
    }

    this.totalDebit = totalDr;
    this.totalCredit = totalCr;
  }

  if (!this.financialYear) {
    this.financialYear = getFinancialYear(this.date);
  }
});

function getFinancialYear(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 4
    ? `${String(year).slice(-2)}${String(year + 1).slice(-2)}`
    : `${String(year - 1).slice(-2)}${String(year).slice(-2)}`;
}

const BusinessVoucher = mongoose.model('BusinessVoucher', businessVoucherSchema);

export default BusinessVoucher;
