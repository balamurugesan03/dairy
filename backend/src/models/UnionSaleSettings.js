import mongoose from 'mongoose';

/**
 * Union Sales → Settings (one document per company)
 *
 *   From Dairy — this society's own procurement. With TS Rate Settings enabled, the
 *                rate is calculated automatically from FAT + SNF of the milk purchase
 *                data and the TS rate in Machine Configuration (TSRateCharge).
 *   To Dairy   — the union / dairy the milk is sent to. Same structure, but the TS
 *                rate periods are entered here by the user (never taken from Machine
 *                Configuration); Qty / FAT / SNF come from the Union Sales slips.
 */
const tsPeriodSchema = new mongoose.Schema({
  tsRate:   { type: Number, required: true, min: 0 },
  fromDate: { type: Date, required: true },
  toDate:   { type: Date, default: null },     // null = open-ended
  remarks:  { type: String, trim: true, default: '' }
}, { _id: true });

const sideSchema = (withManualRates) => new mongoose.Schema({
  tsEnabled:  { type: Boolean, default: false },
  regionName: { type: String, trim: true, default: '' },   // shown as "TS Rate Settings (Tamil Nadu)"
  fromDate:   { type: Date, default: null },               // TS rate applies on/after this date
  ...(withManualRates ? { tsRates: { type: [tsPeriodSchema], default: [] } } : {})
}, { _id: false });

const unionSaleSettingsSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
  fromDairy: { type: sideSchema(false), default: () => ({}) },
  toDairy:   { type: sideSchema(true),  default: () => ({}) },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, collection: 'unionsalesettings' });

unionSaleSettingsSchema.statics.getOrCreate = async function (companyId) {
  let doc = await this.findOne({ companyId });
  if (!doc) doc = await this.create({ companyId });
  return doc;
};

export default mongoose.model('UnionSaleSettings', unionSaleSettingsSchema);
