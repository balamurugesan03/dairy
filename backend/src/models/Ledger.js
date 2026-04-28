import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  ledgerName: {
    type: String,
    required: true,
    trim: true
  },
  ledgerType: {
    type: String,
    enum: [
      // ASSET
      'Cash in Hand',
      'Bank Accounts',
      'Share in Other Institutions',
      'Investment in Govt. Securities',
      'Other Investments',
      'Loans & Advances to Members',
      'Interest Receivable',
      'Other Assets',
      'Fixed Assets - Movables',
      'Fixed Assets - Immovables',
      'Advance due to Society',
      'Loss',
      // LIABILITY
      'Share Capital',
      'Deposits',
      'Borrowings (Loans, Cash Credits)',
      'Statutory Funds and Reserves',
      'Other Funds, Reserves and Provisions',
      'Interest Payable',
      'Grants and Subsidies',
      'Education Fund',
      'Other Liabilities',
      'Advance due by Society',
      'Profit',
      // INCOME
      'Miscellaneous Income',
      'Sales',
      'Trade Income',
      // EXPENSE
      'Establishment Charges',
      'Contingencies',
      'Purchases',
      'Trade Expenses',
      // STOCK
      'Closing Stock',
      'Opening Stock',
      'Closing Stock (Trading)',
      // P&L
      'Net Loss Brought From P&L A/c',
      'Net Profit Brought From P&L A/c',
      // Legacy/Basic Types (keeping for backward compatibility)
      'Sales A/c',
      'Miscellaneous Expenses',
      'Other Revenue',
      'Grants & Aid',
      'Subsidies',
      'Purchases A/c',
      'Accounts Due To (Sundry Creditors)',
      'Other Payable',
      'Deposit A/c',
      'Contingency Fund',
      'Fixed Assets',
      'Movable Assets',
      'Immovable Assets',
      'Other Receivable',
      'Investment A/c',
      'Other Investment',
      'Government Securities',
      'Profit & Loss A/c',
      'Party',
      'Bank',
      'Cash',
      'Income',
      'Expense',
      'Asset',
      'Liability',
      'Capital'
    ],
    required: true
  },
  linkedEntity: {
    entityType: {
      type: String,
      enum: ['Farmer', 'Customer', 'Supplier', 'Agent', 'None'],
      default: 'None'
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },
  openingBalance: {
    type: Number,
    default: 0
  },
  openingBalanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr'
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  balanceType: {
    type: String,
    enum: ['Dr', 'Cr'],
    default: 'Dr'
  },
  parentGroup: {
    type: String,
    trim: true
  },
  voucherType: {
    type: String,
    enum: ['B', 'P', 'R'],  // B=Balance Sheet, P=Profit&Loss, R=Receipt
    default: 'P'
  },
  isFixed: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
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
ledgerSchema.index({ ledgerType: 1 });
ledgerSchema.index({ 'linkedEntity.entityType': 1, 'linkedEntity.entityId': 1 });
ledgerSchema.index({ status: 1 });
ledgerSchema.index({ companyId: 1 });
// Compound indexes — heavily used in report queries (Trading Account, P&L, Balance Sheet)
ledgerSchema.index({ companyId: 1, ledgerType: 1 });
ledgerSchema.index({ companyId: 1, status: 1 });
ledgerSchema.index({ companyId: 1, ledgerType: 1, status: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;
