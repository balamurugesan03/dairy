import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema({
  voucherType: {
    type: String,
    enum: ['Receipt', 'Payment', 'Journal'],
    required: true
  },
  voucherNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  voucherDate: {
    type: Date,
    required: true,
    default: Date.now
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
  referenceType: {
    type: String,
    enum: ['Sales', 'Purchase', 'Payment', 'Manual'],
    default: 'Manual'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  }
}, {
  timestamps: true
});

// Indexes for faster queries
voucherSchema.index({ voucherType: 1, voucherDate: -1 });
voucherSchema.index({ referenceType: 1, referenceId: 1 });

// Validation: Total Debit must equal Total Credit
voucherSchema.pre('save', async function() {
  if (Math.abs(this.totalDebit - this.totalCredit) > 0.01) {
    throw new Error('Total Debit must equal Total Credit');
  }
});

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;
