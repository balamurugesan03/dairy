import mongoose from 'mongoose';

const criteriaFieldSchema = new mongoose.Schema({
  enabled:  { type: Boolean, default: false },
  operator: { type: String, enum: ['>', '<', '=', '>=', '<='], default: '>' },
  value:    { type: Number, default: 0 },
  logic:    { type: String, enum: ['AND', 'OR'], default: 'AND' },
}, { _id: false });

const periodicalRuleSchema = new mongoose.Schema(
  {
    component:    { type: String, enum: ['EARNINGS', 'DEDUCTIONS'], required: true },
    applicableTo: { type: String, enum: ['ALL_PRODUCER', 'NON_MEMBERS', 'MEMBERS'], required: true },
    basedOn:      { type: String, enum: ['MILK_QUANTITY', 'MILK_VALUE', 'POURING_DAYS', 'FIXED_AMOUNT'], required: true },
    pouringTime:  { type: String, enum: ['BOTH_SHIFTS', 'MORNING_AM', 'EVENING_PM'], required: true },

    amRate:    { type: Number, default: 0, min: 0 },
    pmRate:    { type: Number, default: 0, min: 0 },
    fixedRate: { type: Number, default: 0, min: 0 },

    earningDeductionId: { type: mongoose.Schema.Types.ObjectId, ref: 'EarningDeduction' },
    itemName:           { type: String, trim: true, default: '' },

    criteria: {
      milkQty:    { type: criteriaFieldSchema, default: {} },
      milkValue:  { type: criteriaFieldSchema, default: {} },
      pouringDays: {
        enabled:  { type: Boolean, default: false },
        operator: { type: String, enum: ['>', '<', '=', '>=', '<='], default: '>' },
        value:    { type: Number, default: 0 },
        _id:      false,
      },
    },

    collectionCenterType: {
      type:    String,
      enum:    ['PRODUCER_CENTER', 'POURING_CENTER'],
      default: 'PRODUCER_CENTER',
    },
    collectionCenterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CollectionCenter' }],
    allCenters:          { type: Boolean, default: false },

    amountLimit: {
      enabled: { type: Boolean, default: false },
      amount:  { type: Number, default: 0 },
      period:  { type: String, enum: ['APPLYING_PERIOD', 'WHOLE_PERIOD'], default: 'APPLYING_PERIOD' },
      _id:     false,
    },

    wefDate:     { type: Date },
    applyPeriod: { type: String, enum: ['EACH_PERIOD', 'ONCE_IN_MONTH'], default: 'EACH_PERIOD' },

    active:    { type: Boolean, default: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

periodicalRuleSchema.index({ companyId: 1, createdAt: -1 });
periodicalRuleSchema.index({ companyId: 1, component: 1 });

export default mongoose.model('PeriodicalRule', periodicalRuleSchema);
