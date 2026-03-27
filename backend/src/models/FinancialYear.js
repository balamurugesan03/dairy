import mongoose from 'mongoose';

const financialYearSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }, // e.g. "2024-2025"
  startDate: { type: Date, required: true },
  endDate:   { type: Date, required: true },
  status: {
    type: String,
    enum: ['Upcoming', 'Active', 'Closed'],
    default: 'Upcoming'
  },
  isFrozen:  { type: Boolean, default: false },
  closedAt:  { type: Date },
  closedBy:  { type: String },
  notes:     { type: String, trim: true }
}, { timestamps: true });

// One name per company
financialYearSchema.index({ companyId: 1, name: 1 }, { unique: true });
financialYearSchema.index({ companyId: 1, status: 1 });
financialYearSchema.index({ companyId: 1, startDate: 1, endDate: 1 });

export default mongoose.model('FinancialYear', financialYearSchema);
