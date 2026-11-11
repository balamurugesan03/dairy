import mongoose from 'mongoose';

/**
 * Producer Dues → Payments → Payment Register (Karur, Tamil Nadu)
 * ─────────────────────────────────────────────────────────────────────────────
 * One saved Cash or Bank payment run for a settled payment cycle. The amounts
 * are a snapshot of the cycle's saved Payment Register (settled) entries —
 * never recalculated here. Saving pays the cycle's FarmerPayment rows and
 * posts one Dr PRODUCERS DUES / Cr Cash in Hand | <bank ledger> voucher.
 *
 * A producer can be paid only once per settled register: `entries.payKey`
 * (farmerId|sourceRegisterId) is unique across every Saved register.
 */
const entrySchema = new mongoose.Schema({
  farmerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  payKey:          { type: String, required: true },
  centerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter' },
  centerCode:      { type: String, default: '' },
  centerName:      { type: String, default: '' },
  farmerNumber:    { type: String, default: '' },
  producerId:      { type: String, default: '' },     // C1-001
  producerName:    { type: String, default: '' },
  previousBalance: { type: Number, default: 0 },
  qty:             { type: Number, default: 0 },
  milkValue:       { type: Number, default: 0 },
  welfare:         { type: Number, default: 0 },
  loanRec:         { type: Number, default: 0 },
  advance:         { type: Number, default: 0 },     // C/F (cattle feed) advance recovery
  cashAdvance:     { type: Number, default: 0 },
  otherRec:        { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  netPayable:      { type: Number, default: 0 },
  bankName:        { type: String, default: '' },
  accountNumber:   { type: String, default: '' },
  ifsc:            { type: String, default: '' },
  branch:          { type: String, default: '' },
  // FarmerPayment of the settled cycle that this row paid, and what it applied
  farmerPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FarmerPayment' },
  appliedAmount:   { type: Number, default: 0 },
  fpPrev: {
    paymentMode:  String,
    bankLedgerId: mongoose.Schema.Types.ObjectId,
    voucherId:    mongoose.Schema.Types.ObjectId,
  },
}, { _id: true });

const auditSchema = new mongoose.Schema({
  action:  { type: String, enum: ['Created', 'Edited', 'Cancelled'], required: true },
  at:      { type: Date, default: Date.now },
  by:      { type: mongoose.Schema.Types.ObjectId },
  byName:  { type: String, default: '' },
  details: { type: String, default: '' },
}, { _id: false });

const karurPaymentRegisterSchema = new mongoose.Schema({
  companyId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  registerNumber:     { type: String, required: true },
  fromDate:           { type: Date, required: true },
  toDate:             { type: Date, required: true },
  sourceRegisterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentRegister', required: true },
  sourceRegisterType: { type: String, default: '' },
  paymentType:        { type: String, enum: ['Cash', 'Bank'], required: true },
  paymentDate:        { type: Date, required: true },
  centerId:           { type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter', default: null },
  centerLabel:        { type: String, default: 'All Centers' },
  bankFilter:         { type: String, default: '' },  // '' = All Banks
  cashScope:          { type: String, enum: ['withoutBank', 'all'], default: 'withoutBank' },
  bankLedgerId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },
  bankLedgerName:     { type: String, default: '' },
  chequeNumber:       { type: String, default: '', trim: true },
  chequeDetails:      { type: String, default: '', trim: true, maxlength: 500 },
  remarks:            { type: String, default: '', trim: true, maxlength: 500 },
  entries:            [entrySchema],
  producerCount:      { type: Number, default: 0 },
  totalQty:           { type: Number, default: 0 },
  totalMilkValue:     { type: Number, default: 0 },
  totalDeductions:    { type: Number, default: 0 },
  totalAmount:        { type: Number, default: 0 },
  voucherId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', default: null },
  voucherNumber:      { type: String, default: '' },
  status:             { type: String, enum: ['Saved', 'Cancelled'], default: 'Saved' },
  audit:              [auditSchema],
  createdBy:          { type: mongoose.Schema.Types.ObjectId },
}, { timestamps: true });

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

karurPaymentRegisterSchema.pre('save', function () {
  let qty = 0, milk = 0, ded = 0, net = 0;
  for (const e of this.entries) {
    qty += e.qty || 0;
    milk += e.milkValue || 0;
    ded += e.totalDeductions || 0;
    net += e.netPayable || 0;
  }
  this.producerCount = this.entries.length;
  this.totalQty = r2(qty);
  this.totalMilkValue = r2(milk);
  this.totalDeductions = r2(ded);
  this.totalAmount = r2(net);
});

karurPaymentRegisterSchema.index({ companyId: 1, registerNumber: 1 }, { unique: true });
karurPaymentRegisterSchema.index({ companyId: 1, fromDate: -1 });
// One payment per producer per settled cycle (Saved registers only)
karurPaymentRegisterSchema.index(
  { companyId: 1, 'entries.payKey': 1 },
  { unique: true, partialFilterExpression: { status: 'Saved' }, name: 'karur_one_payment_per_producer_cycle' }
);

export default mongoose.model('KarurPaymentRegister', karurPaymentRegisterSchema);
