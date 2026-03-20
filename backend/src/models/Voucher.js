import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  voucherType: {
    type: String,
    enum: [
      // Standard dairy vouchers
      'Receipt', 'Payment', 'Journal', 'Contra',
      // Inventory
      'Purchase',
      // Dairy-specific
      'MilkPurchase', 'MilkSales', 'FarmerPayment',
      'LoanDisbursal', 'AdvancePayment', 'OpeningBalance'
    ],
    required: true
  },
  voucherNumber: {
    type: String,
    required: true,
    trim: true
  },
  voucherDate: {
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
      ref: 'Ledger',
      required: true
    },
    ledgerName: {
      type: String,
      required: true,
      trim: true
    },
    debitAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    narration: {
      type: String,
      trim: true
    }
  }],
  totalDebit: {
    type: Number,
    required: true,
    min: 0
  },
  totalCredit: {
    type: Number,
    required: true,
    min: 0
  },
  narration: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Draft', 'Posted', 'Cancelled'],
    default: 'Posted'
  },
  // Reference linkage
  referenceType: {
    type: String,
    enum: [
      'Sales', 'Purchase', 'Payment', 'Manual',
      'MilkPurchase', 'MilkSales', 'FarmerPayment',
      'LoanDisbursal', 'AdvancePayment', 'Opening',
      'ShareCapital', 'AdmissionFee'
    ],
    default: 'Manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  referenceNumber: {
    type: String,
    trim: true
  },
  // For cancellation — points to the reversal voucher
  cancelledVoucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  cancelledAt: Date,
  cancelledBy: mongoose.Schema.Types.ObjectId,
  cancelReason: String,
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
voucherSchema.index({ companyId: 1, voucherDate: -1 });
voucherSchema.index({ companyId: 1, voucherType: 1, voucherDate: -1 });
voucherSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
voucherSchema.index({ companyId: 1, status: 1 });
voucherSchema.index({ voucherNumber: 1, companyId: 1 }, { unique: true });
voucherSchema.index({ companyId: 1, 'entries.ledgerId': 1, voucherDate: 1 });

// Validation: Total Debit must equal Total Credit
voucherSchema.pre('save', async function() {
  if (Math.abs(this.totalDebit - this.totalCredit) > 0.01) {
    throw new Error(`Voucher imbalanced: Debit=${this.totalDebit} Credit=${this.totalCredit}`);
  }
  if (!this.financialYear) {
    this.financialYear = getFinancialYear(this.voucherDate);
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

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;
