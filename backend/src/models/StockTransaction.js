import mongoose from 'mongoose';

const stockTransactionSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  inventoryType: {
    type: String,
    enum: ['Dairy', 'Business'],
    default: 'Dairy'
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
  // Supplier and Payment Info (for Purchase transactions)
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: {
    type: String,
    trim: true
  },
  paymentMode: {
    type: String,
    enum: ['Credit', 'Cash', 'Adjustment', 'N/A'],
    default: 'Credit'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Bill Summary fields
  grossTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  subsidyAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  ledgerDeduction: {
    type: Number,
    default: 0,
    min: 0
  },
  netTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  // Accounting Integration
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  },
  // Multiple Ledger Entries for payment allocation
  ledgerEntries: [{
    ledgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    narration: {
      type: String,
      trim: true
    }
  }],
  // Multiple Subsidies support
  subsidies: [{
    subsidyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subsidy'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item'
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    }
  }],
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
stockTransactionSchema.index({ inventoryType: 1 });
stockTransactionSchema.index({ inventoryType: 1, transactionType: 1, date: -1 });

const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);

export default StockTransaction;
