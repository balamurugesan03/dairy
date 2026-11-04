import mongoose from 'mongoose';

/**
 * Farmer scheme application (Panchayat milk subsidy / milk incentive forms).
 * One record per farmer + scheme year; the farmer's own details live in
 * Farmer Management and are only copied here as printed on the form —
 * details typed here that the farmer lacks are written back on save.
 *
 * formType:
 *   SUBSIDY   — "പാലിന് സബ്സിഡി അപേക്ഷ ഫോറം" (Janakeeyasoothranam, 2 pages, 14 items)
 *   INCENTIVE — "ക്ഷീരകർഷകർക്ക് പാലളവിന് ഇൻസെന്റീവ്" (Annual Plan, table form, 13 items)
 */
const farmerApplicationSchema = new mongoose.Schema({
  applicationNo:   { type: String, trim: true, default: '' },
  applicationDate: { type: Date, default: Date.now },
  formType:        { type: String, enum: ['SUBSIDY', 'INCENTIVE'], default: 'SUBSIDY' },

  // Scheme year = financial year start (2026 → 2026-2027)
  year:       { type: Number, required: [true, 'Year is required'] },
  panchayat:  { type: String, trim: true, required: [true, 'Panchayat is required'] },
  // Panchayat name as printed in the form heading (e.g. in Malayalam); blank → panchayat
  panchayatLabel: { type: String, trim: true, default: '' },
  schemeName: { type: String, trim: true, default: '' },

  farmerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: [true, 'Farmer is required'] },
  farmerNumber: { type: String, trim: true, default: '' },

  // 1–11 applicant
  applicantName: { type: String, trim: true, required: [true, 'Applicant name is required'] },
  address:       { type: String, trim: true, default: '' },
  pincode:       { type: String, trim: true, default: '' },
  mobileNumber:  { type: String, trim: true, default: '' },
  category:      { type: String, enum: ['', 'General', 'SC', 'ST', 'OBC'], default: '' },
  gender:        { type: String, enum: ['', 'Male', 'Female', 'Other'], default: '' },
  ward:          { type: String, trim: true, default: '' },
  houseNumber:   { type: String, trim: true, default: '' },
  rationCardNo:  { type: String, trim: true, default: '' },
  electionId:    { type: String, trim: true, uppercase: true, default: '' },
  aadhaarNumber: { type: String, trim: true, default: '' },
  bankName:      { type: String, trim: true, default: '' },
  branch:        { type: String, trim: true, default: '' },
  accountNumber: { type: String, trim: true, default: '' },
  ifsc:          { type: String, trim: true, uppercase: true, default: '' },

  // 12 dairy society membership
  isMember:     { type: Boolean, default: true },
  membershipNo: { type: String, trim: true, default: '' },
  societyName:  { type: String, trim: true, default: '' },

  // 13 small / marginal farmer + land
  isSmallFarmer: { type: Boolean, default: null },
  landArea:      { type: String, trim: true, default: '' },
  surveyNumber:  { type: String, trim: true, default: '' },

  // 14 beneficiary list number
  beneficiaryNo: { type: String, trim: true, default: '' },

  // Incentive form 13 / secretary certificate
  cowCount:       { type: Number, default: null },
  avgMilkPerDay:  { type: Number, default: null },
  place:          { type: String, trim: true, default: '' },

  status:    { type: String, enum: ['Draft', 'Submitted', 'Approved'], default: 'Draft' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

farmerApplicationSchema.index({ companyId: 1, year: 1, panchayat: 1 });
farmerApplicationSchema.index({ companyId: 1, farmerId: 1, year: 1, formType: 1 });

const FarmerApplication = mongoose.model('FarmerApplication', farmerApplicationSchema);
export default FarmerApplication;
