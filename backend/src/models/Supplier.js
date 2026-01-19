import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  gstNumber: { type: String },
  address: { type: String },
  openingBalance: { type: Number, default: 0 },
  state: { type: String },
  district: { type: String },
  pincode: { type: String },
  panNumber: { type: String },
  active: { type: Boolean, default: true },

  // Ledger references for accounting
  dueByLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Accounts Due By (Sundry Debtors) - when supplier owes us
  dueToLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' }, // Accounts Due To (Sundry Creditors) - when we owe supplier

  documents: {
    aadhaar: { type: String },
    passbook: { type: String },
    rationCard: { type: String },
    incomeProof: { type: String }
  },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create indexes for better query performance
supplierSchema.index({ supplierId: 1 });
supplierSchema.index({ phone: 1 });
supplierSchema.index({ active: 1 });
supplierSchema.index({ name: 1 });

export default mongoose.model('Supplier', supplierSchema);
