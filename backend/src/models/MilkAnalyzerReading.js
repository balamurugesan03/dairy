import mongoose from 'mongoose';

const milkAnalyzerReadingSchema = new mongoose.Schema({
  farmerName: { type: String, required: true, trim: true },
  fat:        { type: Number, required: true },
  snf:        { type: Number, required: true },
  clr:        { type: Number, default: null },
  density:    { type: Number, default: null },
  addedWater: { type: Number, default: 0 },
  date:       { type: Date, default: Date.now },
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  rawData:    { type: String },
  source:     { type: String, enum: ['serial', 'manual'], default: 'serial' }
}, { timestamps: true });

milkAnalyzerReadingSchema.index({ companyId: 1, date: -1 });

export default mongoose.model('MilkAnalyzerReading', milkAnalyzerReadingSchema);
