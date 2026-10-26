import mongoose from 'mongoose';

/**
 * Union Sales → Settings (one document per company)
 *
 *   From Dairy — this society's own procurement. With TS Rate Settings enabled, the
 *                rate is calculated from FAT + SNF of the milk purchase data and the
 *                From Dairy TS rates kept HERE — separate from the Milk Purchase TS
 *                rate (Machine Configuration / TSRateCharge), which is never used.
 *   To Dairy   — the union / dairy the milk is sent to. Its TS rate periods are also
 *                entered here; Qty / FAT / SNF come from the Union Sales slips.
 *   Both sides use the same TS formula: rate = (FAT + SNF) × TS rate ÷ 100.
 */
const tsPeriodSchema = new mongoose.Schema({
  tsRate:    { type: Number, required: true, min: 0 },
  fromDate:  { type: Date, required: true },
  toDate:    { type: Date, default: null },     // null = open-ended
  useToDate: { type: Boolean, default: false }, // true = toDate fixed by the user; false = runs until the next From Date
  remarks:   { type: String, trim: true, default: '' }
}, { _id: true });

const sideSchema = (withManualRates) => new mongoose.Schema({
  tsEnabled:  { type: Boolean, default: false },
  fromDate:   { type: Date, default: null },               // TS rate applies on/after this date
  ...(withManualRates ? { tsRates: { type: [tsPeriodSchema], default: [] } } : {})
}, { _id: false });

const unionSaleSettingsSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  fromDairy: { type: sideSchema(true),  default: () => ({}) },
  toDairy:   { type: sideSchema(true),  default: () => ({}) },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'unionsalesettings' });

unionSaleSettingsSchema.statics.getOrCreate = async function (companyId) {
  let doc = await this.findOne({ companyId });
  if (!doc) doc = await this.create({ companyId });
  return doc;
};

export default mongoose.model('UnionSaleSettings', unionSaleSettingsSchema);
