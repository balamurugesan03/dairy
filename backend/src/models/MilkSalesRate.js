import mongoose from 'mongoose';

const milkSalesRateSchema = new mongoose.Schema({
  partyType: {
    type: String,
    enum: ['Customer', 'Agent'],
    required: [true, 'Party type is required']
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
    refPath: 'partyType'
  },
  partyName: {
    type: String,
    required: false,
    trim: true
  },
  salesItem: {
    type: String,
    enum: ['Customer Sale', 'Local Sales', 'Sample Sales', 'Credit Sales'],
    required: [true, 'Sales item is required']
  },
  category: {
    type: String,
    enum: ['School', 'Local Sales', 'Sample Sales', 'Credit Sales'],
    required: [true, 'Category is required']
  },
  wefDate: {
    type: Date,
    required: [true, 'Date W.E.F is required']
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: [0, 'Rate cannot be negative']
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

// Prevent duplicate: same party + salesItem + date within same company
milkSalesRateSchema.index(
  { companyId: 1, partyId: 1, salesItem: 1, wefDate: 1 },
  { unique: true, name: 'unique_party_salesitem_wefdate' }
);

milkSalesRateSchema.index({ companyId: 1, partyId: 1, wefDate: -1 });
milkSalesRateSchema.index({ companyId: 1, partyName: 'text' });

export default mongoose.model('MilkSalesRate', milkSalesRateSchema);
