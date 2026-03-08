import mongoose from 'mongoose';

const earningDeductionSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Earning / Deduction name is required'],
      trim:     true,
    },

    nameMl: {
      type:    String,
      trim:    true,
      default: '',
    },

    shortName: {
      type:      String,
      required:  [true, 'Short name is required'],
      trim:      true,
      uppercase: true,
      maxlength: [10, 'Short name cannot exceed 10 characters'],
    },

    category: {
      type:     String,
      required: [true, 'Category is required'],
      enum: [
        'BONUS_INCENTIVE_HISTORICAL',
        'DEPOSIT_SCHEME',
        'HISTORICAL_DEDUCTIONS',
        'INDIVIDUAL_DEDUCTIONS',
        'INDIVIDUAL_EARNINGS',
        'LOAN_RECOVERY',
        'PERIODICAL_DEDUCTIONS',
        'PERIODICAL_EARNINGS',
      ],
    },

    ledgerGroup: {
      type:     String,
      required: [true, 'Ledger group is required'],
      enum: [
        'advance_due_to_society',
        'share_capital',
        'statutory_funds_and_reserves',
        'advance_due_by_society',
        'contingencies',
        'trade_expenses',
      ],
    },

    formula: {
      type:    String,
      trim:    true,
      default: '',
    },

    active: {
      type:    Boolean,
      default: true,
    },

    // Periodical Settings fields
    applyToAll: {
      type:    Boolean,
      default: false,
    },

    defaultAmount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    frequency: {
      type:    String,
      enum:    ['monthly', 'quarterly', 'half-yearly', 'yearly'],
      default: 'monthly',
    },

    companyId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Company',
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
    },
  },
  { timestamps: true }
);

// Prevent duplicate shortName per company
earningDeductionSchema.index({ companyId: 1, shortName: 1 }, { unique: true });
earningDeductionSchema.index({ companyId: 1, active: 1 });
earningDeductionSchema.index({ companyId: 1, category: 1 });

export default mongoose.model('EarningDeduction', earningDeductionSchema);
