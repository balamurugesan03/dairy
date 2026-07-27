import mongoose from 'mongoose';

const bonusRowSchema = new mongoose.Schema(
  {
    farmerId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
    farmerNumber:      { type: String, trim: true },
    memberNo:          { type: String, trim: true },
    farmerName:        { type: String, trim: true },
    centerName:        { type: String, trim: true },
    milkQty:           { type: Number, default: 0 },
    milkAmount:        { type: Number, default: 0 },
    bonusAmount:       { type: Number, default: 0 },
    dividendAmount:    { type: Number, default: 0 },
    totalAmount:       { type: Number, default: 0 }, // bonusAmount + dividendAmount
    bankAccountNumber: { type: String, trim: true },
    bankName:          { type: String, trim: true },
    bankBranch:        { type: String, trim: true },
    bankIfsc:          { type: String, trim: true },
  },
  { _id: false }
);

const bonusRegisterSchema = new mongoose.Schema(
  {
    registerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    caption: {
      type: String,
      trim: true,
      default: 'Bonus Register',
    },
    fromDate: {
      type: Date,
      required: [true, 'From date is required'],
    },
    toDate: {
      type: Date,
      required: [true, 'To date is required'],
    },

    // ── Bonus calculation ────────────────────────────────────────
    rateMode: {
      type: String,
      enum: ['Percentage', 'Rate'],
      default: 'Rate',
    },
    bonusRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    bonusPercent: {
      type: Number,
      min: 0,
      default: 0,
    },
    // Only meaningful when rateMode === 'Rate' — Percentage mode always
    // applies to milk Amount (a % of Qty has no currency meaning).
    basis: {
      type: String,
      enum: ['Qty', 'Amount'],
      default: 'Qty',
    },

    // ── Dividend (optional, activated via checkbox) ────────────────
    dividendEnabled: {
      type: Boolean,
      default: false,
    },
    dividendPercent: {
      type: Number,
      min: 0,
      default: 0,
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

    rows: [bonusRowSchema],
    totalQty: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },       // sum of milk bill amount
    totalBonusAmount: { type: Number, default: 0 },
    totalDividendAmount: { type: Number, default: 0 },
    totalPostAmount: { type: Number, default: 0 },    // bonus + dividend — what gets posted

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

bonusRegisterSchema.index({ companyId: 1, fromDate: 1, toDate: 1 });
bonusRegisterSchema.index({ registerNumber: 1, companyId: 1 }, { unique: true });
bonusRegisterSchema.index({ companyId: 1, posted: 1, paymentMode: 1, postedAt: 1 });

export default mongoose.model('BonusRegister', bonusRegisterSchema);
