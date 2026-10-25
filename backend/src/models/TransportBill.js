import mongoose from 'mongoose';

// A posted transport charge for one route over one period, linked to its voucher
const transportBillSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransportRoute', required: true },
  routeName: { type: String, trim: true },
  vehicleNumber: { type: String, trim: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  voucherDate: { type: Date, required: true },

  chargeType: { type: String, enum: ['KM', 'Litre'], required: true },
  rate: { type: Number, default: 0 },
  trips: { type: Number, default: 0 },
  km: { type: Number, default: 0 },
  litres: { type: Number, default: 0 },
  amount: { type: Number, required: true, min: 0 },

  // Cash / Bank → Payment voucher; Credit → Journal to TRANSPORT CHARGES PAYABLE
  payMode: { type: String, enum: ['Cash', 'Bank', 'Credit'], required: true },
  bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger' },
  voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
  voucherNumber: { type: String, trim: true },

  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

transportBillSchema.index({ companyId: 1, routeId: 1, fromDate: 1, toDate: 1 });
transportBillSchema.index({ companyId: 1, voucherDate: -1 });

export default mongoose.model('TransportBill', transportBillSchema);
