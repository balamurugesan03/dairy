import mongoose from 'mongoose';

const milkSalesSchema = new mongoose.Schema({
  billNo: {
    type: String,
    required: [true, 'Bill number is required'],
    trim: true
  },
  session: {
    type: String,
    enum: ['AM', 'PM'],
    default: 'AM'
  },
  saleMode: {
    type: String,
    enum: ['LOCAL', 'CREDIT'],
    default: 'LOCAL'
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  // LOCAL sale fields
  centerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CollectionCenter'
  },
  centerName: {
    type: String,
    trim: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  },
  agentName: {
    type: String,
    trim: true
  },
  paymentType: {
    type: String,
    enum: ['Cash', 'Bank'],
    default: 'Cash'
  },
  // CREDIT sale fields
  creditorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  creditorName: {
    type: String,
    trim: true
  },
  openingCredit: {
    type: Number,
    default: 0
  },
  // Common fields
  litre: {
    type: Number,
    required: [true, 'Quantity in litres is required'],
    min: 0
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: 0
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

milkSalesSchema.index({ companyId: 1, date: -1 });
milkSalesSchema.index({ companyId: 1, billNo: 1 });
milkSalesSchema.index({ companyId: 1, creditorId: 1 });

export default mongoose.model('MilkSales', milkSalesSchema);
