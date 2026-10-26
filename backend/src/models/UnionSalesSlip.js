import mongoose from 'mongoose';

const unionSalesSlipSchema = new mongoose.Schema({
  slipNo: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    enum: ['AM', 'PM'],
    required: true,
  },
  qty: {
    type: Number,
    required: true,
    min: 0,
  },
  fat: {
    type: Number,
    required: true,
    min: 0,
  },
  snf: {
    type: Number,
    required: true,
    min: 0,
  },
  rate: {
    type: Number,
    required: true,
    min: 0,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  spoilage: {
    type: Boolean,
    default: false,
  },
  unionSpoilage: {
    type: Number,
    default: 0,
    min: 0,
  },
  transportationSpoilage: {
    type: Number,
    default: 0,
    min: 0,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher',
  },
  // 'FromDairy' = generated from the milk purchase data (From Dairy TS rate) and kept in
  // sync by utils/unionFromDairySync.js. Editing it by hand turns it into 'Manual';
  // a Manual slip is never overwritten by the automatic process.
  source: {
    type: String,
    enum: ['Manual', 'FromDairy'],
    default: 'Manual',
  },
}, {
  timestamps: true,
});

// Prevent duplicate entry for same Date + Time per company
unionSalesSlipSchema.index({ date: 1, time: 1, companyId: 1 }, { unique: true });
unionSalesSlipSchema.index({ date: -1, companyId: 1 });

const UnionSalesSlip = mongoose.model('UnionSalesSlip', unionSalesSlipSchema);

export default UnionSalesSlip;
