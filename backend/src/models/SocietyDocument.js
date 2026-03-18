import mongoose from 'mongoose';

const societyDocumentSchema = new mongoose.Schema({
  companyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  documentKey:    { type: String, required: true },   // e.g. 'registration', 'fssai'
  documentName:   { type: String, required: true },   // human-readable label
  documentNumber: { type: String, default: '' },
  expiryDate:     { type: Date },
  fileData:       { type: String },                   // base64 encoded content
  fileName:       { type: String },
  fileType:       { type: String },                   // MIME type
  status:         { type: String, enum: ['Valid', 'Expired', 'Pending'], default: 'Pending' },
}, { timestamps: true });

// One document record per type per company
societyDocumentSchema.index({ companyId: 1, documentKey: 1 }, { unique: true });

export default mongoose.model('SocietyDocument', societyDocumentSchema);
