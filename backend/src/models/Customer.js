import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  gstNumber: { type: String },
  address: { type: String },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  state: { type: String },
  district: { type: String },
  pincode: { type: String },
  panNumber: { type: String },
  category: {
    type: String,
    enum: ['School', 'Anganwadi', 'Hospital', 'Booth', 'Hotel', 'Vendor Sales', 'Others'],
    default: 'Others'
  },
  active: { type: Boolean, default: true },
  ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Due By ledger
  dueToSocietyLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Due to Society ledger

  dateOfJoining: { type: Date },

  documents: {
    aadhaar: { type: String },
    passbook: { type: String },
    rationCard: { type: String },
    incomeProof: { type: String }
  },

  createdAt: { type: Date, default: Date.now },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

// Create indexes for better query performance
customerSchema.index({ customerId: 1, companyId: 1 }, { unique: true });
customerSchema.index({ phone: 1 });
customerSchema.index({ active: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ companyId: 1 });

export default mongoose.model('Customer', customerSchema);
