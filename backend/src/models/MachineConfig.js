import mongoose from 'mongoose';

const machineConfigSchema = new mongoose.Schema({
  deviceName: { type: String, required: true, trim: true },
  port:       { type: String, required: true, trim: true },   // e.g., COM3 or /dev/ttyUSB0
  baudRate:   { type: Number, required: true, default: 9600 },
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

// One config per company
machineConfigSchema.index({ companyId: 1 }, { unique: true });

export default mongoose.model('MachineConfig', machineConfigSchema);
