import mongoose from 'mongoose';

const businessStockTransactionSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessItem',
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
    enum: ['Purchase', 'Sale', 'Opening', 'Adjustment', 'Return', 'Transfer'],
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
  // Supplier and Payment Info
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
    enum: ['Credit', 'Cash', 'Bank', 'UPI', 'N/A'],
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
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  gstAmount: {
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
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
businessStockTransactionSchema.index({ itemId: 1, date: -1 });
businessStockTransactionSchema.index({ referenceType: 1, referenceId: 1 });
businessStockTransactionSchema.index({ transactionType: 1, date: -1 });
businessStockTransactionSchema.index({ supplierId: 1 });
businessStockTransactionSchema.index({ invoiceNumber: 1 });

const BusinessStockTransaction = mongoose.model('BusinessStockTransaction', businessStockTransactionSchema);

export default BusinessStockTransaction;
