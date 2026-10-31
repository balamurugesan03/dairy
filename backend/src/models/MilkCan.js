import mongoose from 'mongoose';

// One sub-centre can as received + tested at the main centre (Milk Purchase → Can No).
// Not a farmer bill: the sub centre's farmers are billed from their own collections.
// The cans of a date + shift build that route's Milk Receipt (source 'Cans'),
// which Milk Receipt & Shortage compares with the sub centre's bills.
const milkCanSchema = new mongoose.Schema({
  date: { type: Date, required: [true, 'Date is required'] },
  shift: { type: String, enum: ['AM', 'PM'], required: [true, 'Shift is required'] },
  canNumber: { type: String, required: [true, 'Can No is required'], trim: true, uppercase: true },

  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter', required: [true, 'Sub Centre is required'] },
  centreName: { type: String, trim: true },

  qty: { type: Number, required: true, min: 0 },
  fat: { type: Number, default: 0, min: 0 },
  clr: { type: Number, default: 0, min: 0 },
  snf: { type: Number, default: 0, min: 0 },

  remarks: { type: String, trim: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

milkCanSchema.index({ companyId: 1, date: 1, shift: 1, canNumber: 1 }, { unique: true, name: 'unique_can_date_shift' });
milkCanSchema.index({ companyId: 1, canNumber: 1, date: -1 });

export default mongoose.model('MilkCan', milkCanSchema);
