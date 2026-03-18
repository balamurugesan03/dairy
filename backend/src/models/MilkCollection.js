import mongoose from 'mongoose';

const milkCollectionSchema = new mongoose.Schema({
  billNo: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  shift: {
    type: String,
    enum: ['AM', 'PM'],
    required: true
  },
  collectionCenter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    required: true
  },
  farmerNumber: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  farmerName: {
    type: String,
    trim: true
  },
  qty: {
    type: Number,
    required: true,
    min: 0
  },
  fat: {
    type: Number,
    required: true,
    min: 0
  },
  clr: {
    type: Number,
    default: 0,
    min: 0
  },
  snf: {
    type: Number,
    default: 0,
    min: 0
  },
  addedWater: {
    type: Number,
    default: 0,
    min: 0
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  incentive: {
    type: Number,
    default: 0,
    min: 0
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  voucherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Voucher'
  }
}, {
  timestamps: true
});

milkCollectionSchema.index({ billNo: 1, companyId: 1 }, { unique: true }); // compound — allows same billNo across companies
milkCollectionSchema.index({ date: 1, shift: 1, companyId: 1 });
milkCollectionSchema.index({ farmerNumber: 1, date: -1 });
milkCollectionSchema.index({ companyId: 1, date: -1 });
milkCollectionSchema.index({ companyId: 1, farmerNumber: 1, date: -1 });

const MilkCollection = mongoose.model('MilkCollection', milkCollectionSchema);

export default MilkCollection;
