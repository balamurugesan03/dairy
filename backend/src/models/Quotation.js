import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessItem' },
  itemCode: String,
  itemName: { type: String, required: true },
  hsnCode: String,
  quantity: { type: Number, required: true, min: 0 },
  unit: String,
  mrp: { type: Number, default: 0 },
  rate: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  gstPercent: { type: Number, default: 0 },
  cgstPercent: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstPercent: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstPercent: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 }
});

const quotationSchema = new mongoose.Schema({
  quotationNumber: { type: String, unique: true },
  quotationDate: { type: Date, default: Date.now },
  validUntil: { type: Date },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'],
    default: 'Draft'
  },
  partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  partyName: String,
  partyOrganization: String,
  partyPhone: String,
  partyEmail: String,
  partyAddress: String,
  partyGstin: String,
  partyState: String,
  salesmanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesman' },
  salesmanName: String,
  items: [quotationItemSchema],
  totalQty: { type: Number, default: 0 },
  grossAmount: { type: Number, default: 0 },
  itemDiscount: { type: Number, default: 0 },
  billDiscount: { type: Number, default: 0 },
  billDiscountPercent: { type: Number, default: 0 },
  taxableAmount: { type: Number, default: 0 },
  totalCgst: { type: Number, default: 0 },
  totalSgst: { type: Number, default: 0 },
  totalIgst: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  roundOff: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  notes: String,
  termsAndConditions: String,
  convertedToInvoice: {
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessSales' },
    invoiceNumber: String,
    convertedDate: Date
  },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

quotationSchema.index({ status: 1 });
quotationSchema.index({ quotationDate: -1 });
quotationSchema.index({ companyId: 1 });

export default mongoose.model('Quotation', quotationSchema);
