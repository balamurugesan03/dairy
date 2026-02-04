import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  gstNumber: { type: String },
  address: { type: String },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  state: { type: String },
  district: { type: String },
  pincode: { type: String },
  panNumber: { type: String },
  active: { type: Boolean, default: true },
  ledgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Due By ledger
  dueToSocietyLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Due to Society ledger

  documents: {
    aadhaar: { type: String },
    passbook: { type: String },
    rationCard: { type: String },
    incomeProof: { type: String }
  },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better query performance
customerSchema.index({ customerId: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ active: 1 });
customerSchema.index({ name: 1 });

export default mongoose.model('Customer', customerSchema);
