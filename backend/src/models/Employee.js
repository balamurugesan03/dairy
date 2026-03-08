import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  department: { type: String, trim: true },
  role: { type: String, trim: true },
  salary: { type: Number, required: true, min: 0 },
  joiningDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, { timestamps: true });

employeeSchema.index({ companyId: 1, status: 1 });

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
