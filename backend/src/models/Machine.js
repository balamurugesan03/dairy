import mongoose from 'mongoose';

const maintenanceLogSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  maintenanceType: {
    type: String,
    enum: ['Preventive', 'Corrective', 'Emergency', 'Annual Service'],
    default: 'Preventive'
  },
  description: { type: String, required: true },
  cost: { type: Number, default: 0 },
  nextMaintenanceDate: Date,
  technicianName: String,
  partsReplaced: String,
  status: { type: String, enum: ['Completed', 'Pending', 'In Progress'], default: 'Completed' }
}, { timestamps: true });

const machineSchema = new mongoose.Schema({
  machineCode: { type: String, sparse: true },
  machineName: { type: String, required: true },
  category: String,
  make: String,
  model: String,
  manufacturer: String,
  serialNumber: String,
  modelNumber: String,
  purchaseDate: Date,
  purchasePrice: { type: Number, default: 0 },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: String,
  warrantyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Warranty' },
  warrantyExpiry: Date,
  location: String,
  department: String,
  assignedTo: String,
  status: {
    type: String,
    enum: ['Active', 'Under Maintenance', 'Disposed', 'Sold', 'Inactive'],
    default: 'Active'
  },
  description: String,
  maintenanceLogs: [maintenanceLogSchema],
  disposalDate: Date,
  disposalPrice: { type: Number, default: 0 },
  disposalReason: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

machineSchema.index({ machineCode: 1 }, { unique: true, sparse: true });
machineSchema.index({ status: 1 });
machineSchema.index({ companyId: 1 });

export default mongoose.model('Machine', machineSchema);
