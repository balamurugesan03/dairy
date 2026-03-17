import mongoose from 'mongoose';

const claimSchema = new mongoose.Schema({
  claimDate: { type: Date, default: Date.now },
  description: { type: String, required: true },
  claimType: { type: String, enum: ['Repair', 'Replacement', 'Refund', 'Other'], default: 'Repair' },
  status: { type: String, enum: ['Pending', 'In Progress', 'Resolved', 'Rejected'], default: 'Pending' },
  resolvedDate: Date,
  resolution: String,
  technicianName: String,
  cost: { type: Number, default: 0 }
}, { timestamps: true });

const warrantySchema = new mongoose.Schema({
  warrantyNumber: { type: String, unique: true },
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessItem' },
  itemName: { type: String, required: true },
  category: String,
  serialNumber: String,
  batchNumber: String,
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessCustomer' },
  customerName: String,
  customerPhone: String,
  customerEmail: String,
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessSales' },
  invoiceNumber: String,
  saleDate: Date,
  warrantyStartDate: { type: Date, default: Date.now },
  warrantyEndDate: Date,
  warrantyPeriod: { type: Number, default: 12 },
  warrantyType: { type: String, enum: ['Manufacturer', 'Dealer', 'Extended'], default: 'Dealer' },
  status: { type: String, enum: ['Active', 'Expired', 'Claimed', 'Void'], default: 'Active' },
  description: String,
  termsAndConditions: String,
  claims: [claimSchema],
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

warrantySchema.index({ warrantyEndDate: 1 });
warrantySchema.index({ status: 1 });
warrantySchema.index({ companyId: 1 });

export default mongoose.model('Warranty', warrantySchema);
