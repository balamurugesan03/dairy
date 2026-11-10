import mongoose from 'mongoose';

/**
 * Ward member of a Panchayat ward, remembered for the LSGD Mithram Statement
 * (the ward member signs the statement). Farmer Management keeps the ward
 * itself as text on the farmer (address.ward); this only adds who the member
 * is, so the next statement for the same ward fills it in.
 */
const lsgdWardMemberSchema = new mongoose.Schema({
  panchayat:  { type: String, trim: true, required: [true, 'Panchayat is required'] },
  ward:       { type: String, trim: true, required: [true, 'Ward is required'] },
  // upper-case keys so "Kanjiramkulam " and "KANJIRAMKULAM" are the same ward
  panchayatKey: { type: String, trim: true, uppercase: true },
  wardKey:      { type: String, trim: true, uppercase: true },
  wardNumber: { type: String, trim: true, default: '' },
  memberName: { type: String, trim: true, required: [true, 'Ward member name is required'] },
  phone:      { type: String, trim: true, default: '' },
  companyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
}, { timestamps: true });

lsgdWardMemberSchema.pre('validate', function () {
  this.panchayatKey = String(this.panchayat || '').trim().toUpperCase();
  this.wardKey = String(this.ward || '').trim().toUpperCase();
});

lsgdWardMemberSchema.index({ companyId: 1, panchayatKey: 1, wardKey: 1, memberName: 1 }, { unique: true });

const LsgdWardMember = mongoose.model('LsgdWardMember', lsgdWardMemberSchema);
export default LsgdWardMember;
