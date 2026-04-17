import mongoose from 'mongoose';

// ─── Milma Chart Master ──────────────────────────────────────────────────────
// One record per chart version per company.  Mirrors the "Chart Master" sheet
// from the Milma Excel upload (dcs_id, user_id, date_entry, checksum excluded).
const milmaChartMasterSchema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  chartId:         { type: Number, required: true },       // 1, 2, 3 … (source chart_id)
  dateFrom:        { type: Date,   required: true },        // effective from date
  rateSNF:         { type: Number, default: 0 },            // SNF rate / ltr
  rateFAT:         { type: Number, default: 0 },            // FAT rate / ltr
  subSNF:          { type: Number, default: 0 },            // Low-rate threshold: SNF <
  subTotalSolids:  { type: Number, default: 0 },            // Low-rate threshold: Total Solids <
  bestSNF:         { type: Number, default: 0 },            // High-rate threshold: SNF >=
  bestTotalSolids: { type: Number, default: 0 },            // High-rate threshold: Total Solids >=
  remarks:         { type: String, default: '' },
  rowCount:        { type: Number, default: 0 },            // denormalised count of detail rows
}, { timestamps: true });

milmaChartMasterSchema.index({ companyId: 1, chartId: 1 }, { unique: true });
milmaChartMasterSchema.index({ companyId: 1, dateFrom: 1 });

// ─── Milma Chart Detail ──────────────────────────────────────────────────────
// The actual rate-lookup table.  Each row = (fat, clr) → rate for a given
// chart version.  dcs_id is NOT stored — companyId serves that role.
const milmaChartDetailSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  chartId:   { type: Number, required: true },  // FK to MilmaChartMaster.chartId
  fat:       { type: Number, required: true },
  clr:       { type: Number, required: true },
  snf:       { type: Number, required: true },
  rate:      { type: Number, required: true },
}, { timestamps: false });

// Compound index used by the lookup query (companyId + chartId + fat + clr)
milmaChartDetailSchema.index({ companyId: 1, chartId: 1, fat: 1, clr: 1 }, { unique: true });

export const MilmaChartMaster = mongoose.model('MilmaChartMaster', milmaChartMasterSchema);
export const MilmaChartDetail = mongoose.model('MilmaChartDetail', milmaChartDetailSchema);
