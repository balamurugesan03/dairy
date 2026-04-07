import mongoose from 'mongoose';

const generalInfoRowSchema = new mongoose.Schema({
  slNo:    { type: Number },
  details: { type: String, trim: true, default: '' },
  value1:  { type: String, trim: true, default: '' },
  value2:  { type: String, trim: true, default: '' },
  value3:  { type: String, trim: true, default: '' }
}, { _id: false });

const populationRowSchema = new mongoose.Schema({
  category: { type: String, trim: true, default: '' },
  sc:       { type: Number, default: null },
  st:       { type: Number, default: null },
  female:   { type: Number, default: null },
  male:     { type: Number, default: null },
  total:    { type: Number, default: null }
}, { _id: false });

const livestockRowSchema = new mongoose.Schema({
  slNo:     { type: Number },
  category: { type: String, trim: true, default: '' },
  unit:     { type: String, trim: true, default: '' },
  value:    { type: Number, default: null },
  avgPerDay:{ type: Number, default: null }
}, { _id: false });

const priceRowSchema = new mongoose.Schema({
  slNo:        { type: Number },
  product:     { type: String, trim: true, default: '' },
  fat:         { type: Number, default: null },
  snf:         { type: Number, default: null },
  avgPriceLtr: { type: Number, default: null }
}, { _id: false });

const additionalRowSchema = new mongoose.Schema({
  slNo:       { type: Number },
  description:{ type: String, trim: true, default: '' },
  remarks1:   { type: String, trim: true, default: '' },
  remarks2:   { type: String, trim: true, default: '' },
  remarks3:   { type: String, trim: true, default: '' }
}, { _id: false });

const agriStatsReportSchema = new mongoose.Schema({
  reportNo:  { type: String, trim: true, default: '' },
  reportDate:{ type: Date, default: Date.now },
  district:  { type: String, trim: true, default: '' },
  month:     { type: String, trim: true, default: '' },
  year:      { type: Number, default: () => new Date().getFullYear() },

  // Section 1
  generalInfo: {
    type: [generalInfoRowSchema],
    default: [
      { slNo: 1, details: 'Name of Local Body',  value1: '', value2: '', value3: '' },
      { slNo: 2, details: 'Name of Village',     value1: '', value2: '', value3: '' },
      { slNo: 3, details: 'Ward Number',         value1: '', value2: '', value3: '' },
      { slNo: 4, details: 'Name of Officer',     value1: '', value2: '', value3: '' }
    ]
  },

  // Section 2
  populationDetails: {
    type: [populationRowSchema],
    default: [
      { category: 'Population', sc: null, st: null, female: null, male: null, total: null },
      { category: 'Farmers',    sc: null, st: null, female: null, male: null, total: null }
    ]
  },

  // Section 3
  livestockProduction: {
    type: [livestockRowSchema],
    default: [
      { slNo: 1, category: 'Milk Production',  unit: 'Litres',  value: null, avgPerDay: null },
      { slNo: 2, category: 'Egg Production',   unit: 'Numbers', value: null, avgPerDay: null },
      { slNo: 3, category: 'Meat Production',  unit: 'Kg',      value: null, avgPerDay: null },
      { slNo: 4, category: 'Other Products',   unit: '',        value: null, avgPerDay: null },
      { slNo: 5, category: 'Total Production', unit: '',        value: null, avgPerDay: null }
    ]
  },

  // Section 4
  priceDetails: {
    type: [priceRowSchema],
    default: [
      { slNo: 1, product: 'Milk',           fat: null, snf: null, avgPriceLtr: null },
      { slNo: 2, product: 'Other Products', fat: null, snf: null, avgPriceLtr: null }
    ]
  },

  // Section 5
  additionalDetails: {
    type: [additionalRowSchema],
    default: [
      { slNo: 1, description: '', remarks1: '', remarks2: '', remarks3: '' },
      { slNo: 2, description: '', remarks1: '', remarks2: '', remarks3: '' },
      { slNo: 3, description: '', remarks1: '', remarks2: '', remarks3: '' },
      { slNo: 4, description: '', remarks1: '', remarks2: '', remarks3: '' }
    ]
  },

  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved'],
    default: 'Draft'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

agriStatsReportSchema.index({ companyId: 1 });
agriStatsReportSchema.index({ reportDate: -1 });
agriStatsReportSchema.index({ district: 1 });

const AgriStatsReport = mongoose.model('AgriStatsReport', agriStatsReportSchema);
export default AgriStatsReport;
