import mongoose from 'mongoose';
import { generateCode } from './Counter.js';

const producerPaymentSchema = new mongoose.Schema({
  paymentNumber: { type: String, unique: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  isPartialPayment: { type: Boolean, default: false },
  processingPeriod: {
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true }
  },
  paymentCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter', default: null },
  paymentCenterName: { type: String, default: 'All' },
  paymentDate: { type: Date, required: true, default: Date.now },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  producerNumber: { type: String },
  producerName: { type: String },
  refNo: { type: String, trim: true },
  lastAbstractBalance: { type: Number, default: 0 },
  amountPaid: { type: Number, required: true, min: 0 },
  printSlip: { type: Boolean, default: false },
  paymentMode: { type: String, enum: ['Cash', 'Bank', 'Cheque', 'UPI', 'NEFT', 'RTGS'], default: 'Cash' },
  remarks: { type: String, maxlength: 500 },
  status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
  cancelledAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

producerPaymentSchema.index({ companyId: 1, paymentDate: -1 });
producerPaymentSchema.index({ companyId: 1, farmerId: 1 });
producerPaymentSchema.index({ paymentNumber: 1 });

producerPaymentSchema.pre('save', async function () {
  if (!this.paymentNumber) {
    this.paymentNumber = await generateCode('PTP', this.companyId, { pad: 5 });
  }
});

const ProducerPayment = mongoose.model('ProducerPayment', producerPaymentSchema);
export default ProducerPayment;
