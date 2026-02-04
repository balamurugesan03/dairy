import mongoose from 'mongoose';

const businessLedgerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  group: {
    type: String,
    required: true,
    enum: [
      'Cash-in-Hand',
      'Bank Accounts',
      'Sundry Debtors',
      'Sundry Creditors',
      'Sales Accounts',
      'Purchase Accounts',
      'Direct Expenses',
      'Indirect Expenses',
      'Direct Incomes',
      'Indirect Incomes',
      'Fixed Assets',
      'Current Assets',
      'Current Liabilities',
      'Capital Account',
      'Loans & Advances',
      'Investments',
      'Duties & Taxes',
      'Provisions',
      'Reserves & Surplus',
      'Suspense Account',
      'Stock-in-Hand'
    ]
  },
  type: {
    type: String,
    required: true,
    enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity']
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceType: {
    type: String,
    enum: ['Debit', 'Credit'],
    default: 'Debit'
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    trim: true
  },
  // Party details (for Sundry Debtors/Creditors)
  partyDetails: {
    contactPerson: String,
    phone: String,
    email: String,
    address: String,
    gstNumber: String,
    panNumber: String,
    creditLimit: Number,
    creditDays: Number
  },
  // Bank details (for Bank Accounts)
  bankDetails: {
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branch: String,
    accountType: {
      type: String,
      enum: ['Savings', 'Current', 'OD', 'CC']
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  businessType: {
    type: String,
    default: 'Private Firm'
  }
}, {
  timestamps: true
});

// Indexes
businessLedgerSchema.index({ name: 1 });
businessLedgerSchema.index({ group: 1 });
businessLedgerSchema.index({ type: 1 });
businessLedgerSchema.index({ code: 1 });

const BusinessLedger = mongoose.model('BusinessLedger', businessLedgerSchema);

export default BusinessLedger;
