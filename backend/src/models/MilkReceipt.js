import mongoose from 'mongoose';

// Milk as received + tested at the main centre for one route (van) and shift.
// Compared against the sub centres' own collections (MilkCollection) to find shortage.
const receiptLineSchema = new mongoose.Schema({
  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter', required: true },
  centreName: { type: String, trim: true },
  qty: { type: Number, default: 0, min: 0 },
  fat: { type: Number, default: 0, min: 0 },
  clr: { type: Number, default: 0, min: 0 },
  snf: { type: Number, default: 0, min: 0 }
}, { _id: false });

const milkReceiptSchema = new mongoose.Schema({
  date: { type: Date, required: [true, 'Date is required'] },
  shift: { type: String, enum: ['AM', 'PM'], required: [true, 'Shift is required'] },

  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute', required: [true, 'Route is required'] },
  routeName: { type: String, trim: true },
  vehicleNumber: { type: String, trim: true, uppercase: true },
  driverName: { type: String, trim: true },

  // Total → one weighment/test for the whole van; Centre → each sub centre's cans tested separately
  entryMode: { type: String, enum: ['Total', 'Centre'], default: 'Total' },
  lines: { type: [receiptLineSchema], default: [] },

  // Received totals (for Centre mode these are derived from lines on save)
  qty: { type: Number, default: 0, min: 0 },
  fat: { type: Number, default: 0, min: 0 },
  clr: { type: Number, default: 0, min: 0 },
  snf: { type: Number, default: 0, min: 0 },

  remarks: { type: String, trim: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

const round = (n, d = 2) => Number((Number(n) || 0).toFixed(d));

milkReceiptSchema.pre('save', function () {
  if (this.entryMode === 'Centre') {
    const qty = this.lines.reduce((s, l) => s + (l.qty || 0), 0);
    const w = (k) => (qty ? this.lines.reduce((s, l) => s + (l.qty || 0) * (l[k] || 0), 0) / qty : 0);
    this.qty = round(qty);
    this.fat = round(w('fat'));
    this.clr = round(w('clr'));
    this.snf = round(w('snf'));
  } else {
    this.lines = [];
  }
});

milkReceiptSchema.index({ companyId: 1, date: 1, shift: 1, routeId: 1 }, { unique: true, name: 'unique_receipt_date_shift_route' });
milkReceiptSchema.index({ companyId: 1, date: -1 });

export default mongoose.model('MilkReceipt', milkReceiptSchema);
