import mongoose from 'mongoose';

const stockTransactionSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  transactionType: {
    type: String,
    enum: ['Stock In', 'Stock Out'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  freeQty: {
    type: Number,
    default: 0,
    min: 0
  },
  rate: {
    type: Number,
    default: 0,
    min: 0
  },
  referenceType: {
    type: String,
    enum: ['Purchase', 'Sale', 'Opening', 'Adjustment', 'Return'],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  purchaseDate: {
    type: Date
  },
  invoiceDate: {
    type: Date
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  issueCentre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  subsidyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subsidy'
  },
  subsidyAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
stockTransactionSchema.index({ itemId: 1, date: -1 });
stockTransactionSchema.index({ referenceType: 1, referenceId: 1 });

const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);

export default StockTransaction;
