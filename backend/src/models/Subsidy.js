import mongoose from 'mongoose';

const subsidySchema = new mongoose.Schema({
  subsidyName: {
    type: String,
    required: true,
    trim: true
  },
  subsidyType: {
    type: String,
    enum: ['Subsidy', 'Discount'],
    default: 'Subsidy',
    required: true
  },
  ledgerGroup: {
    type: String,
    enum: [
      'Advance due to Society',
      'Advance due by Society',
      'Contingencies',
      'Trade Expenses',
      'Trade Income',
      'Miscellaneous Income'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  description: {
    type: String,
    trim: true,
    default: ''
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
subsidySchema.index({ subsidyName: 1 });
subsidySchema.index({ subsidyType: 1 });
subsidySchema.index({ ledgerGroup: 1 });
subsidySchema.index({ status: 1 });
subsidySchema.index({ companyId: 1 });

const Subsidy = mongoose.model('Subsidy', subsidySchema);

export default Subsidy;
