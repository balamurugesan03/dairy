import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  companyId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  dateOfInspection: { type: Date, required: true },
  district:        { type: String, default: '' },
  society:         { type: String, default: '' },

  dairyDevelopmentUnit:          { type: String, default: '' },
  nameOfSociety:                 { type: String, default: '' },

  membersMillingCount:           { type: Number, default: 0 },
  membersMilkQty:                { type: Number, default: 0 },
  nonMembersMillingCount:        { type: Number, default: 0 },
  nonMembersMilkQty:             { type: Number, default: 0 },
  nonMembersMilkPrice:           { type: Number, default: 0 },
  totalMilkQty:                  { type: Number, default: 0 },
  totalMilkAmount:               { type: Number, default: 0 },

  scStFarmersCount:              { type: Number, default: 0 },
  scStMilkQty:                   { type: Number, default: 0 },

  localSalesQty:                 { type: Number, default: 0 },
  localSalesPrice:               { type: Number, default: 0 },
  schoolSalesQty:                { type: Number, default: 0 },
  schoolSalesPrice:              { type: Number, default: 0 },
  productionUnitQty:             { type: Number, default: 0 },
  productionUnitPrice:           { type: Number, default: 0 },
  dairySalesQty:                 { type: Number, default: 0 },
  dairySalesPrice:               { type: Number, default: 0 },
  totalSalesQty:                 { type: Number, default: 0 },
  totalSalesAmount:              { type: Number, default: 0 },

  milkShortfallExcess:           { type: Number, default: 0 },
  dailyProfitMilkTrading:        { type: Number, default: 0 },

  cashBalanceAsOnDate:           { type: Number, default: 0 },
  bankBalancePreviousMonth:      { type: Number, default: 0 },
  cattleFeedAdvanceOutstanding:  { type: Number, default: 0 },
  producerDueAmountOutstanding:  { type: Number, default: 0 },
}, { timestamps: true });

schema.index({ companyId: 1, dateOfInspection: 1 }, { unique: true });

export default mongoose.model('InspectionReport', schema);
