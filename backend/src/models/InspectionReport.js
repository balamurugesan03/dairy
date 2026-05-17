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

  // Section H: Outstanding – Previous Month (29-30)
  schoolMilkSalesOutstanding:        { type: Number, default: 0 },
  milkCreditSalesOutstanding:        { type: Number, default: 0 },

  // Section I: Previous Year – Milk Data (31-43)
  prevYearMilkPurchaseQty:           { type: Number, default: 0 },
  prevYearLocalSalesQty:             { type: Number, default: 0 },
  prevYearMilkPurchasePrice:         { type: Number, default: 0 },
  prevYearLocalSalesPrice:           { type: Number, default: 0 },
  prevYearSchoolSalesQty:            { type: Number, default: 0 },
  prevYearSchoolSalesPrice:          { type: Number, default: 0 },
  prevYearProductionUnitQty:         { type: Number, default: 0 },
  prevYearProductionUnitPrice:       { type: Number, default: 0 },
  prevYearDairySalesQty:             { type: Number, default: 0 },
  prevYearDairySalesPrice:           { type: Number, default: 0 },
  prevYearMilkShortfallExcess:       { type: Number, default: 0 },
  prevYearCattleFeedStock:           { type: Number, default: 0 },
  prevYearMilkProcurementProfit:     { type: Number, default: 0 },

  // Section J: Previous Year – Cattle Feed (44-48)
  prevYearCattleFeedPurchasePrice:   { type: Number, default: 0 },
  prevYearCattleFeedSalesPrice:      { type: Number, default: 0 },
  prevYearCattleFeedClosingStock:    { type: Number, default: 0 },
  prevYearCattleFeedSalesCommission: { type: Number, default: 0 },
  prevYearCattleFeedStockShortfall:  { type: Number, default: 0 },

  // Section K: Trade Analysis (49-57)
  totalTradeIncome:                  { type: Number, default: 0 },
  prevYearTradeExpenses:             { type: Number, default: 0 },
  prevYearTradeProfit:               { type: Number, default: 0 },
  totalSalaryExpenses:               { type: Number, default: 0 },
  salaryExpenseRatio:                { type: Number, default: 0 },
  totalOperatingExpenses:            { type: Number, default: 0 },
  prevYearNetProfit:                 { type: Number, default: 0 },
  netProfitPerSocietyAccounts:       { type: Number, default: 0 },
  netProfitDifference:               { type: Number, default: 0 },

  // Section L: Employees (58-59)
  permanentEmployeesCount:           { type: Number, default: 0 },
  temporaryEmployeesCount:           { type: Number, default: 0 },

  // Section M: Section 80 & Welfare Fund (60-64)
  section80Implementation:           { type: String, default: '' },
  section80NonImplementationReason:  { type: String, default: '' },
  welfareFundMembersCount:           { type: Number, default: 0 },
  farmersToAddWelfareFund:           { type: Number, default: 0 },
  welfareFundArrears:                { type: Number, default: 0 },

  // Section N: Incentives & Advances (65-68)
  milkPriceIncentiveAmount:          { type: Number, default: 0 },
  secretaryAdvanceOutstanding:       { type: Number, default: 0 },
  presidentAdvanceOutstanding:       { type: Number, default: 0 },
  agenciesAmountPayable:             { type: Number, default: 0 },

  // Section O: Audit & Compliance (69-73)
  lastAuditReportYear:               { type: String, default: '' },
  auditReportDueTo:                  { type: Number, default: 0 },
  auditReportDueBy:                  { type: Number, default: 0 },
  dailyWrittenDownCompletionDate:    { type: String, default: '' },
  societyWrittenRecordsDate:         { type: String, default: '' },
}, { timestamps: true });

schema.index({ companyId: 1, dateOfInspection: 1 }, { unique: true });

export default mongoose.model('InspectionReport', schema);
