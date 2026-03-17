import mongoose from 'mongoose';

const businessCustomerSchema = new mongoose.Schema({
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
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

businessCustomerSchema.index({ customerId: 1 });
businessCustomerSchema.index({ phone: 1 });
businessCustomerSchema.index({ active: 1 });
businessCustomerSchema.index({ name: 1 });
businessCustomerSchema.index({ companyId: 1 });

export default mongoose.model('BusinessCustomer', businessCustomerSchema);
