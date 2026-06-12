import mongoose from 'mongoose';

const numField = (def = 0) => ({ type: Number, default: def });

const bmccSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  month:     { type: Number, required: true, min: 1, max: 12 },
  year:      { type: Number, required: true },

  expenses: {
    buildingRent:           numField(),
    officeExpenses:         numField(),
    electricityCharges:     numField(),
    telephoneCharges:       numField(),
    generatorFuelExpense:   numField(),
    generatorOperatorWages: numField(),
    dieselExpense:          numField(),
    vehicleExpense:         numField(),
    labourCharge:           numField(),
    stationery:             numField(),
    computerMaintenance:    numField(),
    waterCharges:           numField(),
    internetCharges:        numField(),
    auditExpense:           numField(),
    otherExpense:           numField(),
  },

  milkProcurement: {
    totalMilkProcured:   numField(),
    avgDailyProcurement: numField(),
    procurementDays:     numField(),
    totalProducerCount:  numField(),
    avgFAT:              numField(),
    avgSNF:              numField(),
  },

  dgHourMeter: {
    openingReading: numField(),
    closingReading: numField(),
  },

  dieselConsumption: {
    openingStock: numField(),
    purchasedQty: numField(),
    consumedQty:  numField(),
  },

  equipmentExpenses: {
    motorRepair:             numField(),
    pumpMaintenance:         numField(),
    generatorMaintenance:    numField(),
    serviceCharges:          numField(),
  },

  remarks:   { type: String, default: '' },

  approvals: {
    supervisorName:    { type: String, default: '' },
    recommendedAmount: numField(),
    ampo:              { type: String, default: '' },
    mpo:               { type: String, default: '' },
    amPI:              { type: String, default: '' },
  },
}, { timestamps: true });

bmccSchema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });

export default mongoose.model('BMCCOperatingCost', bmccSchema);
