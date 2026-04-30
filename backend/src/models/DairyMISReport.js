import mongoose from 'mongoose';

const threeCol = {
  lastMonth:   { type: Number, default: 0 },
  duringMonth: { type: Number, default: 0 },
  total:       { type: Number, default: 0 },
};

const threeStr = {
  lastMonth:   { type: String, default: '' },
  duringMonth: { type: String, default: '' },
  total:       { type: String, default: '' },
};

const memBlock = {
  members:    { type: Number, default: 0 },
  nonMembers: { type: Number, default: 0 },
  total:      { type: Number, default: 0 },
};

const catBlock = {
  sc: { type: Number, default: 0 },
  st: { type: Number, default: 0 },
  female: { type: Number, default: 0 },
  male:   { type: Number, default: 0 },
  total:  { type: Number, default: 0 },
};

const salesRow = {
  quantity:  { type: Number, default: 0 },
  value:     { type: Number, default: 0 },
  avgLDay:   { type: Number, default: 0 },
};

const otherBiz = {
  cattleFeeds:  { type: Number, default: 0 },
  mineralSales: { type: Number, default: 0 },
  total:        { type: Number, default: 0 },
};

const boardRow = {
  lastMonth: { type: String, default: '' },
  month:     { type: String, default: '' },
};

const schema = new mongoose.Schema({
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  month:       { type: Number, required: true, min: 1, max: 12 },
  year:        { type: Number, required: true },
  reportDate:  { type: String, default: '' },
  societyName: { type: String, default: '' },

  section1: {
    totalRegisteredMembers: memBlock,
    milkPouringMembers:     memBlock,
    totalMilkPurchaseLtr:   memBlock,
    totalMilkPurchaseValue: memBlock,
  },

  section2: {
    nos:          catBlock,
    milkQuantity: catBlock,
  },

  section3: {
    localSales:       salesRow,
    schoolSales:      salesRow,
    productUnitSales: salesRow,
    toDairy:          salesRow,
    fromDairy:        salesRow,
    totalSales:       salesRow,
    milkSalesIncome:  salesRow,
  },

  section4: {
    qualityFromMilma:   { fat: { type: Number, default: 0 }, snf: { type: Number, default: 0 }, avgPriceLtr: { type: Number, default: 0 } },
    societyWiseQuality: { fat: { type: Number, default: 0 }, snf: { type: Number, default: 0 }, avgPriceLtr: { type: Number, default: 0 } },
  },

  section5: {
    purchasedThisMonth: otherBiz,
    openingStock:       otherBiz,
    salesThisMonth:     otherBiz,
    closingStock:       otherBiz,
  },

  section6: {
    otherSalesIncome: threeCol,
    totalTradeIncome: threeCol,
    tradeExpense:     threeCol,
    tradeProfitAmt:   threeCol,
    tradeProfitPct:   threeCol,
    salaryAllowances: threeCol,
    otherExpenses:    threeCol,
    netProfit:        threeCol,
    welfareFund:      threeCol,
    welfareFundPaid:  threeCol,
    welfareFundDate:  threeStr,
  },

  section7: {
    boardMeetingDate:        boardRow,
    numberOfParticipants:    boardRow,
    milkPouringBoardMembers: boardRow,
    milkAbove20L:            boardRow,
    numberOfAgendas:         boardRow,
    numberOfDecisions:       boardRow,
    complaintsReceived:      boardRow,
    solvedComplaints:        boardRow,
    yearOfLastAudit:         boardRow,
    auditClassification:     boardRow,
    dateOfLastElection:      boardRow,
  },

  section8: {
    calibrationDate:    { type: String, default: '' },
    milkAnalyserDate:   { type: String, default: '' },
    societyMBRT:        { type: String, default: '' },
    mastitisDate:       { type: String, default: '' },
    farmerTrainingDate: { type: String, default: '' },
    subStandardFarmers: { type: Number, default: 0 },
  },
}, { timestamps: true });

schema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('DairyMISReport', schema);
