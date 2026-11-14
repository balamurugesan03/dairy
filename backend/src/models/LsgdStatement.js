import mongoose from 'mongoose';

/**
 * A saved LSGD Milk Statement (Dairy Reports → LSGD Reports).
 *
 * Keeps the filters, the generated rows as they were (a snapshot, so the saved
 * statement reads the same later even if Milk Purchase changes), and the user's
 * edits on top: removed producers, Subsidy Allotted / Last Subsidy Allotted
 * amounts, hidden columns, the documents option and the Malayalam footer note.
 * Removing a producer here never touches Farmer Management.
 */
const lsgdStatementSchema = new mongoose.Schema({
  companyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title:         { type: String, trim: true, default: '' },
  fromDate:      { type: String, required: [true, 'From Date is required'] },   // YYYY-MM-DD
  toDate:        { type: String, required: [true, 'To Date is required'] },
  rate:          { type: Number, default: 0 },
  panchayat:     { type: String, trim: true, required: [true, 'Panchayat is required'] },
  panchayatKey:  { type: String, trim: true, default: '' },
  ward:          { type: String, trim: true, default: '' },
  wardNumber:    { type: String, trim: true, default: '' },
  wardMember:    { type: String, trim: true, default: '' },
  onlySuppliers: { type: Boolean, default: true },
  scope:         { type: String, enum: ['panchayat', 'all'], default: 'panchayat' },

  // Snapshot of /lsgd-mithram/statement → { months, rows, meta }
  months:        { type: [mongoose.Schema.Types.Mixed], default: [] },
  rows:          { type: [mongoose.Schema.Types.Mixed], default: [] },
  meta:          { type: mongoose.Schema.Types.Mixed, default: {} },

  // Edits
  removed:       { type: [String], default: [] },                       // farmerIds left out
  overrides:     { type: mongoose.Schema.Types.Mixed, default: {} },    // farmerId → Subsidy Allotted
  lastSubsidy:   { type: mongoose.Schema.Types.Mixed, default: {} },    // farmerId → Last Subsidy Allotted
  hiddenColumns: { type: [String], default: [] },
  withDocs:      { type: Boolean, default: true },
  footerNote:    { type: String, default: '' },

  // Final figures (for the list and for the next statement's Last Subsidy Allotted)
  producerCount:   { type: Number, default: 0 },
  totalMilk:       { type: Number, default: 0 },
  subsidyAllotted: { type: Number, default: 0 },
  allotted:        { type: mongoose.Schema.Types.Mixed, default: {} },  // farmerId → final Subsidy Allotted

  createdBy:     { type: String, default: '' },
  updatedBy:     { type: String, default: '' }
}, { timestamps: true, minimize: false });

lsgdStatementSchema.pre('validate', function () {
  this.panchayatKey = String(this.panchayat || '').trim().toUpperCase();
});

lsgdStatementSchema.index({ companyId: 1, toDate: -1 });

const LsgdStatement = mongoose.model('LsgdStatement', lsgdStatementSchema);
export default LsgdStatement;
