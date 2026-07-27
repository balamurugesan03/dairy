import mongoose from 'mongoose';

const incentiveRowSchema = new mongoose.Schema(
  {
    farmerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
    farmerNumber:      { type: String, trim: true },
    memberNo:          { type: String, trim: true },
    farmerName:        { type: String, trim: true },
    centerName:        { type: String, trim: true },
    milkQty:           { type: Number, default: 0 },
    milkAmount:        { type: Number, default: 0 },
    incentiveAmount:   { type: Number, default: 0 },
    bankAccountNumber: { type: String, trim: true },
    bankName:          { type: String, trim: true },
    bankBranch:        { type: String, trim: true },
    bankIfsc:          { type: String, trim: true },
  },
  { _id: false }
);

const incentiveRegisterSchema = new mongoose.Schema(
  {
    registerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
      default: 'Incentive Register',
    },
    fromDate: {
      type: Date,
      required: [true, 'From date is required'],
    },
    toDate: {
      type: Date,
      required: [true, 'To date is required'],
    },
    incentiveRate: {
      type: Number,
      required: [true, 'Incentive rate is required'],
      min: 0,
    },
    partyFilter: {
      type: String,
      enum: ['All', 'Member', 'NonMember', 'Center'],
      default: 'All',
    },
    centerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CollectionCenter',
    },
    centerName: {
      type: String,
      trim: true,
    },
    basis: {
      type: String,
      enum: ['Qty', 'Amount'],
      default: 'Qty',
    },
    rows: [incentiveRowSchema],
    totalQty: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    totalIncentiveAmount: { type: Number, default: 0 },

    // ── Post to Daybook ──────────────────────────────────────────
    paymentMode: {
      type: String,
      enum: ['Cash', 'Bank'],
    },
    bankLedgerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ledger',
    },
    bankLedgerName: {
      type: String,
      trim: true,
    },
    posted: {
      type: Boolean,
      default: false,
    },
    postedAt: {
      type: Date,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
    },
    status: {
      type: String,
      enum: ['Draft', 'Posted'],
      default: 'Draft',
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

incentiveRegisterSchema.index({ companyId: 1, fromDate: 1, toDate: 1 });
incentiveRegisterSchema.index({ registerNumber: 1, companyId: 1 }, { unique: true });
incentiveRegisterSchema.index({ companyId: 1, posted: 1, paymentMode: 1, postedAt: 1 });

export default mongoose.model('IncentiveRegister', incentiveRegisterSchema);
