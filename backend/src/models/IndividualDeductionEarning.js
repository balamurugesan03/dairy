import mongoose from 'mongoose';

const individualDeductionEarningSchema = new mongoose.Schema(
  {
    date: {
      type:     Date,
      required: [true, 'Date is required'],
    },

    type: {
      type:     String,
      enum:     ['DEDUCTION', 'EARNING'],
      required: [true, 'Type is required'],
    },

    producerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Farmer',
    },

    producerCode: {
      type:  String,
      trim:  true,
    },

    producerName: {
      type:  String,
      trim:  true,
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

    amount: {
      type:     Number,
      required: [true, 'Amount is required'],
      min:      [0, 'Amount cannot be negative'],
    },

    description: {
      type:    String,
      trim:    true,
      default: '',
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

individualDeductionEarningSchema.index({ companyId: 1, date: -1 });
individualDeductionEarningSchema.index({ companyId: 1, producerId: 1 });
individualDeductionEarningSchema.index({ companyId: 1, type: 1 });

export default mongoose.model('IndividualDeductionEarning', individualDeductionEarningSchema);
