import mongoose from 'mongoose';

const businessSupplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  gstNumber: { type: String },
  panNumber: { type: String },
  address: { type: String },
  state: { type: String },
  district: { type: String },
  pincode: { type: String },
  openingBalance: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  creditDays: { type: Number, default: 0 },
  bankName: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  active: { type: Boolean, default: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

businessSupplierSchema.index({ supplierId: 1, companyId: 1 }, { unique: true });
businessSupplierSchema.index({ companyId: 1 });
businessSupplierSchema.index({ name: 1 });
businessSupplierSchema.index({ active: 1 });

export default mongoose.model('BusinessSupplier', businessSupplierSchema);
