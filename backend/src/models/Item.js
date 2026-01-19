import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  itemCode: {
    type: String,
    unique: true,
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
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

// Indexes for faster queries
itemSchema.index({ status: 1 });

const Item = mongoose.model('Item', itemSchema);

export default Item;
