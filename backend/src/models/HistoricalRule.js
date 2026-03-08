import mongoose from 'mongoose';

const historicalRuleSchema = new mongoose.Schema(
  {
    component: {
      type:     String,
      enum:     ['EARNINGS', 'DEDUCTIONS', 'BONUS'],
      required: [true, 'Component is required'],
    },

    applicableTo: {
      type:     String,
      enum:     ['ALL_PRODUCER', 'NON_MEMBERS', 'MEMBERS'],
      required: [true, 'Applicable To is required'],
    },

    basedOn: {
      type:     String,
      enum:     ['MILK_QUANTITY', 'MILK_VALUE', 'POURING_DAYS', 'FIXED_AMOUNT'],
      required: [true, 'Based On is required'],
    },

    pouringTime: {
      type:     String,
      enum:     ['BOTH_SHIFTS', 'MORNING_AM', 'EVENING_PM'],
      required: [true, 'Pouring Time is required'],
    },

    amRate: {
      type:    Number,
      default: 0,
      min:     0,
    },

    pmRate: {
      type:    Number,
      default: 0,
      min:     0,
    },

    fixedRate: {
      type:    Number,
      default: 0,
      min:     0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    earningDeductionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'EarningDeduction',
    },

    itemName: {
      type:    String,
      trim:    true,
      default: '',
    },

    applyDate: {
      type: Date,
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

historicalRuleSchema.index({ companyId: 1, createdAt: -1 });
historicalRuleSchema.index({ companyId: 1, component: 1 });

export default mongoose.model('HistoricalRule', historicalRuleSchema);
