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
      // Income Types
      'Sales A/c',
      'Trade Income',
      'Miscellaneous Income',
      'Other Revenue',
      'Grants & Aid',
      'Subsidies',
      // Expense Types
      'Purchases A/c',
      'Trade Expenses',
      'Establishment Charges',
      'Miscellaneous Expenses',
      // Party Types
      'Accounts Due To (Sundry Creditors)',
      // Liability Types
      'Other Payable',
      'Other Liabilities',
      'Deposit A/c',
      'Contingency Fund',
      'Education Fund',
      // Asset Types
      'Fixed Assets',
      'Movable Assets',
      'Immovable Assets',
      'Other Assets',
      'Other Receivable',
      // Investment Types
      'Investment A/c',
      'Other Investment',
      'Government Securities',
      // Capital Types
      'Share Capital',
      // Final/Special Types
      'Profit & Loss A/c',
      // Legacy/Basic Types (keeping for backward compatibility)
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
      enum: ['Farmer', 'Customer', 'Supplier', 'None'],
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
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
ledgerSchema.index({ ledgerType: 1 });
ledgerSchema.index({ 'linkedEntity.entityType': 1, 'linkedEntity.entityId': 1 });
ledgerSchema.index({ status: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);

export default Ledger;
