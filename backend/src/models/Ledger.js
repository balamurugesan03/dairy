import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  ledgerName: {
    type: String,
    required: true,
    trim: true
  },
  ledgerType: {
    type: String,
    enum: ['Party', 'Bank', 'Cash', 'Income', 'Expense', 'Asset', 'Liability', 'Capital'],
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
