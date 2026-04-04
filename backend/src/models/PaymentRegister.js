import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema({
  slNo:            { type: Number },
  farmerId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
  productId:       { type: String, default: '' },
  productName:     { type: String, default: '' },
  center:          { type: String, default: '' },
  qty:             { type: Number, default: 0 },
  milkValue:       { type: Number, default: 0 },
  previousBalance: { type: Number, default: 0 },
  // Creditor Bill earning/deduction fields
  otherEarnings:   { type: Number, default: 0 },    // Creditor Bill: Other Earnings
  welfare:         { type: Number, default: 0 },    // Creditor Bill: Welfare | Producers: Welfare
  deductions:      { type: Number, default: 0 },    // Creditor Bill: Deductions
  // Producer Register fields
  cfRec:           { type: Number, default: 0 },
  loanAdv:         { type: Number, default: 0 },
  cashPocket:      { type: Number, default: 0 },
  payStatus:       { type: String, enum: ['Payable', 'Receivable', ''], default: '' },
  netPay:          { type: Number, default: 0 },
}, { _id: true });

const paymentRegisterSchema = new mongoose.Schema({
  companyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  fromDate:     { type: Date, required: true },
  toDate:       { type: Date, required: true },
  registerType: { type: String, enum: ['Creditor', 'Producers'], default: 'Creditor' },

  entries: [entrySchema],

  // Totals (shared)
  totalQty:             { type: Number, default: 0 },
  totalMilkValue:       { type: Number, default: 0 },
  totalPreviousBalance: { type: Number, default: 0 },
  totalNetPay:          { type: Number, default: 0 },
  // Creditor totals
  totalOtherEarnings:   { type: Number, default: 0 },
  totalWelfare:         { type: Number, default: 0 },
  totalDeductions:      { type: Number, default: 0 },
  // Producer totals
  totalCfRec:           { type: Number, default: 0 },
  totalLoanAdv:         { type: Number, default: 0 },
  totalCashPocket:      { type: Number, default: 0 },

  status:    { type: String, enum: ['Draft', 'Saved', 'Printed'], default: 'Draft' },
  remarks:   { type: String, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Pre-save: auto SL numbers, recalculate netPay & totals
paymentRegisterSchema.pre('save', function () {
  let tQty = 0, tMilk = 0, tPrev = 0, tNet = 0;
  let tOtherEarnings = 0, tWelfare = 0, tDeductions = 0, tCfRec = 0, tLoanAdv = 0, tCashPocket = 0;

  this.entries.forEach((e, i) => {
    e.slNo = i + 1;

    if (this.registerType === 'Producers') {
      // Net Payable = Milk Value − Welfare − C/F Rec − Loan Adv − Cash Pocket + Previous Balance
      e.netPay = (e.milkValue || 0) - (e.welfare || 0) - (e.cfRec || 0) - (e.loanAdv || 0) - (e.cashPocket || 0) + (e.previousBalance || 0);
      e.payStatus = e.netPay > 0 ? 'Payable' : e.netPay < 0 ? 'Receivable' : '';
    } else {
      // Creditor Bill: Net Pay = Milk Value + Previous Balance + Other Earnings − Welfare − Deductions
      e.netPay = (e.milkValue || 0) + (e.previousBalance || 0) + (e.otherEarnings || 0) - (e.welfare || 0) - (e.deductions || 0);
    }

    tQty           += e.qty             || 0;
    tMilk          += e.milkValue       || 0;
    tPrev          += e.previousBalance || 0;
    tOtherEarnings += e.otherEarnings   || 0;
    tWelfare       += e.welfare         || 0;
    tDeductions    += e.deductions      || 0;
    tCfRec       += e.cfRec           || 0;
    tLoanAdv     += e.loanAdv         || 0;
    tCashPocket  += e.cashPocket      || 0;
    tNet         += e.netPay;
  });

  this.totalQty             = tQty;
  this.totalMilkValue       = tMilk;
  this.totalPreviousBalance = tPrev;
  this.totalOtherEarnings   = tOtherEarnings;
  this.totalWelfare         = tWelfare;
  this.totalDeductions      = tDeductions;
  this.totalCfRec           = tCfRec;
  this.totalLoanAdv         = tLoanAdv;
  this.totalCashPocket      = tCashPocket;
  this.totalNetPay          = tNet;
});

paymentRegisterSchema.index({ companyId: 1, fromDate: -1 });
paymentRegisterSchema.index({ companyId: 1, status: 1 });

const PaymentRegister = mongoose.model('PaymentRegister', paymentRegisterSchema);
export default PaymentRegister;
