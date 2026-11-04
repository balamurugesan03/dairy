import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import {
  computePayroll, applyComputation, overridesFromPayroll, paySalary, revertSalaryPayment, monthRange
} from '../utils/hrmEngine.js';

const POPULATE = 'name employeeCode department role salary salaryType paymentMode bankName accountNo ifsc pfNumber esiNumber joiningDate';

/** Employees on the rolls for (part of) the month. */
const employeesForMonth = async (companyId, month, year, employeeIds) => {
  const { start, end } = monthRange(month, year);
  const q = {
    companyId,
    joiningDate: { $lte: end },
    $or: [{ status: 'Active' }, { exitDate: { $gte: start } }]
  };
  if (employeeIds?.length) q._id = { $in: employeeIds };
  return Employee.find(q).sort({ employeeCode: 1, name: 1 });
};

/**
 * Preview payroll for the month — nothing is saved.
 * POST /salary/preview { month, year, employeeIds?, unmarkedAsAbsent?, overrides?: { [employeeId]: {...} } }
 */
export const previewSalary = async (req, res) => {
  try {
    const month = parseInt(req.body.month);
    const year = parseInt(req.body.year);
    const { employeeIds, unmarkedAsAbsent = false, overrides = {} } = req.body;
    const employees = await employeesForMonth(req.companyId, month, year, employeeIds);
    const existing = await Payroll.find({ companyId: req.companyId, month, year }).lean();
    const existingMap = new Map(existing.map(p => [String(p.employeeId), p]));

    const rows = [];
    for (const emp of employees) {
      const ex = existingMap.get(String(emp._id));
      const ov = { ...(ex ? overridesFromPayroll(ex) : {}), ...(overrides[String(emp._id)] || {}) };
      const calc = await computePayroll({ employee: emp, month, year, companyId: req.companyId, overrides: ov, unmarkedAsAbsent });
      rows.push({
        ...calc,
        employee: { _id: emp._id, name: emp.name, employeeCode: emp.employeeCode, department: emp.department, role: emp.role, paymentMode: emp.paymentMode },
        existing: ex ? { _id: ex._id, status: ex.status, netSalary: ex.netSalary } : null
      });
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** Create or recompute one payroll. Paid payrolls are never touched. */
const upsertPayroll = async ({ companyId, employee, month, year, overrides, unmarkedAsAbsent }) => {
  let doc = await Payroll.findOne({ companyId, employeeId: employee._id, month, year });
  if (doc && doc.status === 'Paid') return { skipped: true, reason: 'Already paid', doc };
  const calc = await computePayroll({ employee, month, year, companyId, overrides, unmarkedAsAbsent });
  if (calc.netSalary < 0) throw new Error(`Net salary for ${employee.name} would be negative (${calc.netSalary}). Reduce deductions.`);
  if (!doc) doc = new Payroll({ companyId, employeeId: employee._id, month, year });
  applyComputation(doc, calc);
  if (doc.status === 'Approved') doc.status = 'Pending';   // recomputed → needs approval again
  await doc.save();
  return { doc };
};

// Process salary for one employee
export const createSalary = async (req, res) => {
  try {
    const { employeeId, unmarkedAsAbsent = false } = req.body;
    const month = parseInt(req.body.month);
    const year = parseInt(req.body.year);
    const employee = await Employee.findOne({ _id: employeeId, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Legacy simple form: basic/overtime/deduction given directly
    const overrides = req.body.overrides || {
      bonus: req.body.bonus, arrears: req.body.arrears,
      otherDeduction: req.body.otherDeduction ?? req.body.deduction,
      overtimeHours: req.body.overtimeHours, loanRecoveries: req.body.loanRecoveries, remarks: req.body.remarks
    };
    const { doc, skipped, reason } = await upsertPayroll({ companyId: req.companyId, employee, month, year, overrides, unmarkedAsAbsent });
    if (skipped) return res.status(400).json({ success: false, message: `Payroll for ${employee.name} is ${reason.toLowerCase()} for this month` });
    await doc.populate('employeeId', POPULATE);
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const processSalary = (req, res) => createSalary(req, res);

/**
 * Generate payroll for many employees at once.
 * POST /salary/bulk-process { month, year, unmarkedAsAbsent?, rows?: [{ employeeId, overrides }] }
 * Without rows → every employee on the rolls, using stored overrides when re-run.
 */
export const bulkProcessSalary = async (req, res) => {
  try {
    const month = parseInt(req.body.month);
    const year = parseInt(req.body.year);
    const { unmarkedAsAbsent = false, rows } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'month and year are required' });

    const ids = Array.isArray(rows) ? rows.map(r => r.employeeId) : null;
    const employees = await employeesForMonth(req.companyId, month, year, ids);
    const rowMap = new Map((rows || []).map(r => [String(r.employeeId), r.overrides]));
    const existing = await Payroll.find({ companyId: req.companyId, month, year }).lean();
    const existingMap = new Map(existing.map(p => [String(p.employeeId), p]));

    const saved = [];
    const skipped = [];
    const errors = [];
    for (const employee of employees) {
      try {
        const ex = existingMap.get(String(employee._id));
        const overrides = { ...(ex ? overridesFromPayroll(ex) : {}), ...(rowMap.get(String(employee._id)) || {}) };
        const r = await upsertPayroll({ companyId: req.companyId, employee, month, year, overrides, unmarkedAsAbsent });
        if (r.skipped) skipped.push({ name: employee.name, reason: r.reason });
        else saved.push(r.doc);
      } catch (e) {
        errors.push({ name: employee.name, message: e.message });
      }
    }
    res.json({ success: true, data: saved, count: saved.length, skipped, errors });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all payroll records
export const getAllSalaries = async (req, res) => {
  try {
    const { month, year, employee, status } = req.query;
    const query = { companyId: req.companyId };
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (employee) query.employeeId = employee;
    if (status) query.status = status;

    const records = await Payroll.find(query)
      .populate('employeeId', POPULATE)
      .populate('voucherId', 'voucherNumber voucherDate')
      .populate('bankLedgerId', 'ledgerName')
      .sort({ year: -1, month: -1, createdAt: 1 });
    records.sort((a, b) => (b.year - a.year) || (b.month - a.month) ||
      String(a.employeeId?.employeeCode || '').localeCompare(String(b.employeeId?.employeeCode || '')));

    const sum = (f) => records.reduce((s, r) => s + (f(r) || 0), 0);
    res.json({
      success: true,
      data: records,
      totals: {
        count: records.length,
        gross: sum(r => r.grossSalary || (r.basicSalary + r.overtime)),
        deductions: sum(r => r.deduction),
        net: sum(r => r.netSalary),
        pf: sum(r => r.deductions?.pf),
        loanRecovery: sum(r => (r.deductions?.loanRecovery || 0) + (r.deductions?.advanceRecovery || 0)),
        paid: records.filter(r => r.status === 'Paid').length,
        paidAmount: sum(r => r.status === 'Paid' ? r.netSalary : 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get payroll by ID
export const getSalaryById = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', POPULATE)
      .populate('voucherId', 'voucherNumber voucherDate')
      .populate('bankLedgerId', 'ledgerName');
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update payroll: edit overrides and recompute from attendance
export const updateSalary = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    if (record.status === 'Paid') return res.status(400).json({ success: false, message: 'Paid salary cannot be edited — revert the payment first' });
    const employee = await Employee.findOne({ _id: record.employeeId, companyId: req.companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const overrides = { ...overridesFromPayroll(record), ...(req.body.overrides || {}) };
    const { doc } = await upsertPayroll({
      companyId: req.companyId, employee, month: record.month, year: record.year,
      overrides, unmarkedAsAbsent: !!req.body.unmarkedAsAbsent
    });
    await doc.populate('employeeId', POPULATE);
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete payroll
export const deleteSalary = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    if (record.status === 'Paid') return res.status(400).json({ success: false, message: 'Paid salary cannot be deleted — revert the payment first' });
    await record.deleteOne();
    res.json({ success: true, message: 'Payroll record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve payroll (single)
export const approveSalary = async (req, res) => {
  try {
    const record = await Payroll.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId, status: 'Pending' },
      { status: 'Approved', approvedAt: new Date() },
      { new: true }
    ).populate('employeeId', POPULATE);
    if (!record) return res.status(404).json({ success: false, message: 'Payroll not found or not pending' });
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Approve many: { ids } or { month, year }
export const bulkApproveSalary = async (req, res) => {
  try {
    const { ids, month, year } = req.body;
    const q = { companyId: req.companyId, status: 'Pending' };
    if (ids?.length) q._id = { $in: ids };
    else if (month && year) { q.month = parseInt(month); q.year = parseInt(year); }
    else return res.status(400).json({ success: false, message: 'ids or month/year required' });
    const r = await Payroll.updateMany(q, { status: 'Approved', approvedAt: new Date() });
    res.json({ success: true, count: r.modifiedCount });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Mark payroll as paid → Payment voucher + loan recoveries
export const markSalaryPaid = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId }).populate('employeeId', POPULATE);
    if (!record) return res.status(404).json({ success: false, message: 'Payroll record not found' });
    if (record.status !== 'Approved') return res.status(400).json({ success: false, message: 'Approve the salary before paying' });
    const { paymentMode = record.employeeId?.paymentMode || 'Cash', bankLedgerId, paidDate } = req.body || {};
    await paySalary(record, { paymentMode, bankLedgerId, paidDate }, req.companyId);
    await record.populate('voucherId', 'voucherNumber voucherDate');
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Pay many approved salaries: { ids, paymentMode?, bankLedgerId?, paidDate? }
// paymentMode 'Employee' → each employee's own payment mode.
export const bulkPaySalary = async (req, res) => {
  try {
    const { ids = [], paymentMode = 'Employee', bankLedgerId, paidDate } = req.body;
    const records = await Payroll.find({ _id: { $in: ids }, companyId: req.companyId, status: 'Approved' }).populate('employeeId', POPULATE);
    const paid = [];
    const errors = [];
    for (const rec of records) {
      try {
        const mode = paymentMode === 'Employee' ? (rec.employeeId?.paymentMode || 'Cash') : paymentMode;
        await paySalary(rec, { paymentMode: mode, bankLedgerId, paidDate }, req.companyId);
        paid.push(rec._id);
      } catch (e) {
        errors.push({ name: rec.employeeId?.name, message: e.message });
      }
    }
    res.json({ success: true, count: paid.length, skipped: ids.length - records.length, errors });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Undo a payment (voucher + loan recoveries removed, status back to Approved)
export const revertSalaryPaid = async (req, res) => {
  try {
    const record = await Payroll.findOne({ _id: req.params.id, companyId: req.companyId, status: 'Paid' });
    if (!record) return res.status(404).json({ success: false, message: 'Paid payroll not found' });
    await revertSalaryPayment(record, req.companyId);
    await record.populate('employeeId', POPULATE);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get pending payroll
export const getPendingSalaries = async (req, res) => {
  try {
    const records = await Payroll.find({ companyId: req.companyId, status: 'Pending' }).populate('employeeId', POPULATE);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get unpaid payroll
export const getUnpaidSalaries = async (req, res) => {
  try {
    const records = await Payroll.find({ companyId: req.companyId, status: { $ne: 'Paid' } }).populate('employeeId', POPULATE);
    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Payslip data
export const generatePayslip = (req, res) => getSalaryById(req, res);
