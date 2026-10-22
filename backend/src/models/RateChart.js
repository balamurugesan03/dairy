import mongoose from 'mongoose';

// ─── Manual Entry Rate Chart ─────────────────────────────────────────────────
const manualEntrySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fromDate:  { type: Date,   required: true },
  clr:       { type: Number, default: 0 },
  fat:       { type: Number, default: 0 },
  snf:       { type: Number, default: 0 },
  rate:      { type: Number, default: 0 }
}, { timestamps: true });

// ─── Apply Formula Rate Chart ────────────────────────────────────────────────
const applyFormulaSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fromDate:  { type: Date,   required: true },
  minFAT:    { type: Number, default: 0 },
  maxFAT:    { type: Number, default: 0 },
  minSNF:    { type: Number, default: 0 },
  maxSNF:    { type: Number, default: 0 },
  fatRate:   { type: Number, default: 0 },
  snfRate:   { type: Number, default: 0 }
}, { timestamps: true });

// ─── Low Chart ───────────────────────────────────────────────────────────────
const lowChartSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fromDate:  { type: Date,   required: true },
  clr:       { type: Number, default: 0 },
  fat:       { type: Number, default: 0 },
  snf:       { type: Number, default: 0 },
  rate:      { type: Number, default: 0 }
}, { timestamps: true });

// ─── Gold / Less / Existing Rate Chart ──────────────────────────────────────
const goldLessChartSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  chartType: { type: String, enum: ['Low Chart', 'KG Chart', 'SNF Chart'], required: true },
  value:     { type: Number, default: 0 },
  fromDate:  { type: Date,   required: true },
  toggle:    { type: String, enum: ['100', 'Less'], default: '100' }
}, { timestamps: true });

// ─── Slab Rate ───────────────────────────────────────────────────────────────
const slabRateSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  slabRate:  { type: Number, default: 0 },
  fromDate:  { type: Date,   required: true }
}, { timestamps: true });

// ─── TS (Total Solid) Rate Charge ────────────────────────────────────────────
// Rate per litre = (FAT% + SNF%) × tsRate / 100. Each record applies to a
// date period; an open-ended period has no toDate. Milk entries store the
// computed rate, so editing a period never rewrites past transactions.
const tsRateChargeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  tsRate:    { type: Number, required: true, min: 0 },
  fromDate:  { type: Date,   required: true },
  toDate:    { type: Date,   default: null },
  remarks:   { type: String, default: '' }
}, { timestamps: true });

export const ManualEntry    = mongoose.model('ManualEntry',    manualEntrySchema);
export const ApplyFormula   = mongoose.model('ApplyFormula',   applyFormulaSchema);
export const LowChart       = mongoose.model('LowChart',       lowChartSchema);
export const GoldLessChart  = mongoose.model('GoldLessChart',  goldLessChartSchema);
export const SlabRate       = mongoose.model('SlabRate',       slabRateSchema);
export const TSRateCharge   = mongoose.model('TSRateCharge',   tsRateChargeSchema);
