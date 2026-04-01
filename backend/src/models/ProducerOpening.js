import mongoose from 'mongoose';

const producerOpeningSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  producerNumber: { type: String, required: true, trim: true },
  producerName: { type: String, required: true, trim: true },
  dueAmount: { type: Number, default: 0, min: 0 },
  cfAdvance: { type: Number, default: 0, min: 0 },
  loanAdvance: { type: Number, default: 0, min: 0 },
  cashAdvance: { type: Number, default: 0, min: 0 },
  revolvingFund: { type: Number, default: 0, min: 0 },
  totalRecovery: { type: Number, default: 0, min: 0 },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

producerOpeningSchema.index({ companyId: 1, date: -1 });
producerOpeningSchema.index({ companyId: 1, farmerId: 1 }, { unique: true });

const ProducerOpening = mongoose.model('ProducerOpening', producerOpeningSchema);
export default ProducerOpening;
