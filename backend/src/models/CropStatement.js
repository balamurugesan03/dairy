import mongoose from 'mongoose';

const cropRowSchema = new mongoose.Schema({
  slNo:               { type: Number },
  cropCultivated:     { type: String, trim: true, default: '' },
  areaOwned:          { type: Number, default: 0 },
  areaLeased:         { type: Number, default: 0 },
  totalCultivatedArea:{ type: Number, default: 0 },
  areaAffected:       { type: Number, default: 0 },
  percentageLoss:     { type: Number, default: 0 },
  descriptionOfDamage:{ type: String, trim: true, default: '' },
  typeOfDamage:       { type: String, trim: true, default: '' }
}, { _id: false });

const cropStatementSchema = new mongoose.Schema({
  statementNo: { type: String, trim: true, default: '' },
  statementDate: { type: Date, default: Date.now },

  // Farmer info
  farmerName:   { type: String, trim: true, required: [true, 'Farmer name is required'] },
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farmer',
    default: null
  },
  surveyNumber: { type: String, trim: true, default: '' },

  // Bank info
  bankName:          { type: String, trim: true, default: '' },
  loanAccountNumber: { type: String, trim: true, default: '' },
  aadhaarNumber:     { type: String, trim: true, default: '' },
  mobileNumber:      { type: String, trim: true, default: '' },

  // Crop damage table
  cropRows: { type: [cropRowSchema], default: [] },

  // Footer declarations
  descriptionOfDamagesOccurred: { type: String, trim: true, default: '' },
  farmerDeclaration:            { type: String, trim: true, default: '' },
  officerDeclaration:           { type: String, trim: true, default: '' },

  status: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved'],
    default: 'Draft'
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });

cropStatementSchema.index({ companyId: 1 });
cropStatementSchema.index({ farmerId: 1 });
cropStatementSchema.index({ statementDate: -1 });

const CropStatement = mongoose.model('CropStatement', cropStatementSchema);
export default CropStatement;
