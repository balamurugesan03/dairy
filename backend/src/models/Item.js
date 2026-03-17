import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    trim: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  measurement: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    trim: true
  },
  openingBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  salesRate: {
    type: Number,
    default: 0,
    min: 0
  },
  wholesalePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  retailPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  gstPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  hsnCode: {
    type: String,
    trim: true
  },
  purchaseLedger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  },
  salesLedger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ledger'
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
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
itemSchema.index({ status: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ companyId: 1 });
itemSchema.index({ itemCode: 1, companyId: 1 }, { unique: true, sparse: true });

const Item = mongoose.model('Item', itemSchema);

export default Item;
