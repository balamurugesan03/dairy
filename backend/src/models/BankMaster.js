import mongoose from 'mongoose';

const bankMasterSchema = new mongoose.Schema({
  bankName:    { type: String, required: true, trim: true },
  branch:      { type: String, trim: true, default: '' },
  ifsc:        { type: String, trim: true, uppercase: true, default: '' },
  micr:        { type: String, trim: true, default: '' },
  bankLedgerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ledger', default: null },
  companyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

export default mongoose.model('BankMaster', bankMasterSchema);
