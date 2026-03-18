import mongoose from 'mongoose';

const societyInfoSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },

  // ── Basic Information ──────────────────────────────────────────
  societyCode:       { type: String, default: '' },
  societyName:       { type: String, default: '' },
  doorNo:            { type: String, default: '' },
  city:              { type: String, default: '' },
  state:             { type: String, default: '' },
  pinCode:           { type: String, default: '' },
  phone:             { type: String, default: '' },
  fax:               { type: String, default: '' },
  email:             { type: String, default: '' },
  financialYearFrom: { type: Date },
  financialYearTo:   { type: Date },
  welfareCode:       { type: String, default: '' },
  noOfStaff:         { type: Number, default: 0 },

  // ── Audit & Board Details ──────────────────────────────────────
  auditedYear:           { type: String, default: '' },
  auditedClassification: { type: String, default: '' },
  presidentName:         { type: String, default: '' },
  presidentGender:       { type: String, enum: ['Male', 'Female', ''], default: '' },
  boardMaleCount:        { type: Number, default: 0 },
  boardFemaleCount:      { type: Number, default: 0 },
  milkMaleCount:         { type: Number, default: 0 },
  milkFemaleCount:       { type: Number, default: 0 },
  boardMeetingDate:      { type: Date },
  nextElectionDate:      { type: Date },
}, { timestamps: true });

export default mongoose.model('SocietyInfo', societyInfoSchema);
