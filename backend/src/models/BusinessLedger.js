import mongoose from 'mongoose';

// Map group → accounting nature (used for balance direction and reports)
const GROUP_NATURE_MAP = {
  // Assets (Debit normal — debit increases)
  'Cash-in-Hand':    'Asset',
  'Bank Accounts':   'Asset',
  'Sundry Debtors':  'Asset',
  'Stock-in-Hand':   'Asset',
  'Fixed Assets':    'Asset',
  'Current Assets':  'Asset',
  'Loans & Advances': 'Asset',
  'Investments':     'Asset',
  // Liabilities (Credit normal — credit increases)
  'Sundry Creditors':    'Liability',
  'Current Liabilities': 'Liability',
  'Duties & Taxes':      'Liability',
  'Provisions':          'Liability',
  'Reserves & Surplus':  'Liability',
  'Suspense Account':    'Liability',
  // Equity
  'Capital Account': 'Equity',
  // Income (Credit normal)
  'Sales Accounts':   'Income',
  'Direct Incomes':   'Income',
  'Indirect Incomes': 'Income',
  // Expense (Debit normal)
  'Purchase Accounts': 'Expense',
  'Direct Expenses':   'Expense',
  'Indirect Expenses': 'Expense',
};

const businessLedgerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    trim: true,
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
  // Accounting nature — auto-derived from group in pre-save
  nature: {
    type: String,
    enum: ['Asset', 'Liability', 'Income', 'Expense', 'Equity'],
    trim: true
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
  // 'Debit' / 'Credit' (kept as full words for backward compatibility with existing data)
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
  // TDS applicability
  tdsApplicable: {
    type: Boolean,
    default: false
  },
  tdsSection: String,  // '194C', '194J', etc.
  tdsRate: Number,
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
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

// Pre-save: auto-derive nature from group
businessLedgerSchema.pre('save', async function() {
  if (this.group) {
    const derivedNature = GROUP_NATURE_MAP[this.group];
    if (derivedNature) {
      this.nature = derivedNature;
      // Keep type in sync with nature (Equity maps to Liability for type field compatibility)
      if (!this.type) {
        this.type = derivedNature === 'Equity' ? 'Liability' : derivedNature;
      }
    }
  }
});

// Indexes
businessLedgerSchema.index({ name: 1 });
businessLedgerSchema.index({ group: 1 });
businessLedgerSchema.index({ nature: 1 });
businessLedgerSchema.index({ type: 1 });
businessLedgerSchema.index({ code: 1, companyId: 1 }, { unique: true, sparse: true });
businessLedgerSchema.index({ companyId: 1 });
businessLedgerSchema.index({ companyId: 1, group: 1, status: 1 });

const BusinessLedger = mongoose.model('BusinessLedger', businessLedgerSchema);

export { GROUP_NATURE_MAP };
export default BusinessLedger;
