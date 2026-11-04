/**
 * HRM core flow shared by Attendance, Leave, Payroll and Loan controllers.
 *
 *   Attendance (+ approved Leave days)  ─┐
 *   Employee salary structure           ─┼─► computePayroll() ─► Payroll
 *   Active loans/advances (EMI)         ─┘                          │
 *                                         Mark Paid ─► Payment voucher + loan recovery
 *
 * Accounts posting on salary payment:
 *   Dr SALARY & ALLOWANCES (gross − bonus)   Dr STAFF BONUS (bonus)
 *   Cr Cash in Hand / Bank (net pay)
 *   Cr STAFF PROVIDENT FUND (PF) · ESI PAYABLE · PROFESSIONAL TAX PAYABLE
 *   Cr Employee Loan A/c / Employee Advance A/c (recoveries)
 *   Cr STAFF RECOVERIES (other deductions)
 */
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Loan from '../models/Loan.js';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import {
  findOrCreateLedger, generateVoucherNumber, updateLedgerBalances, reverseLedgerBalances
} from './accountingHelper.js';

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r0 = (n) => Math.round(Number(n) || 0);

// ─── Dates (server-local calendar days) ──────────────────────────────────────
/** 'YYYY-MM-DD' (or Date) → local midnight Date. */
export const toDay = (value) => {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
export const endOfDay = (d) => { const e = toDay(d); e.setHours(23, 59, 59, 999); return e; };
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
export const monthRange = (month, year) => ({
  start: new Date(year, month - 1, 1),
  end: new Date(year, month, 0, 23, 59, 59, 999),
  days: new Date(year, month, 0).getDate()
});
/** Every calendar day between two dates (inclusive). */
export const eachDay = (from, to) => {
  const out = [];
  const cur = toDay(from);
  const last = toDay(to);
  while (cur <= last) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
};

// ─── Ledgers ─────────────────────────────────────────────────────────────────
export const HRM_LEDGERS = {
  salary:  ['SALARY & ALLOWANCES', 'Establishment Charges', 'EXPENSE', 'Dr'],
  bonus:   ['STAFF BONUS', 'Establishment Charges', 'EXPENSE', 'Dr'],
  pf:      ['STAFF PROVIDENT FUND', 'Advance due by Society', 'LIABILITY', 'Cr'],
  esi:     ['ESI PAYABLE', 'Advance due by Society', 'LIABILITY', 'Cr'],
  pt:      ['PROFESSIONAL TAX PAYABLE', 'Advance due by Society', 'LIABILITY', 'Cr'],
  other:   ['STAFF RECOVERIES', 'Miscellaneous Income', 'INCOME', 'Cr'],
  Loan:    ['Employee Loan A/c', 'Advance due to Society', 'ASSET', 'Dr'],
  Advance: ['Employee Advance A/c', 'Advance due to Society', 'ASSET', 'Dr']
};
export const hrmLedger = (key, companyId, session) => {
  const [name, type, group, bal] = HRM_LEDGERS[key];
  return findOrCreateLedger(name, type, group, bal, companyId, session);
};

/** Cash in Hand, or the chosen / first bank ledger. */
export const getPayLedger = async (mode, bankLedgerId, companyId) => {
  if (mode === 'Bank') {
    let bank = bankLedgerId ? await Ledger.findOne({ _id: bankLedgerId, companyId }) : null;
    if (!bank) bank = await Ledger.findOne({ companyId, ledgerType: { $in: ['Bank', 'Bank Accounts'] }, status: 'Active' });
    if (!bank) bank = await findOrCreateLedger('Bank Account', 'Bank', 'Bank Accounts', 'Dr', companyId);
    return bank;
  }
  let cash = await Ledger.findOne({ companyId, ledgerType: { $in: ['Cash', 'Cash in Hand'] }, status: 'Active' });
  if (!cash) cash = await findOrCreateLedger('Cash in Hand', 'Cash', 'Cash', 'Dr', companyId);
  return cash;
};

/** Save a balanced voucher and apply ledger balances. Zero lines are dropped. */
export const postVoucher = async ({ voucherType, date, companyId, entries, narration, referenceType, referenceId, referenceNumber }) => {
  const lines = entries
    .map(e => ({ ...e, debitAmount: r2(e.debitAmount), creditAmount: r2(e.creditAmount), narration: e.narration || narration }))
    .filter(e => e.debitAmount > 0 || e.creditAmount > 0);
  const totalDebit = r2(lines.reduce((s, e) => s + e.debitAmount, 0));
  const totalCredit = r2(lines.reduce((s, e) => s + e.creditAmount, 0));
  if (!lines.length || totalDebit <= 0) return null;

  const voucher = new Voucher({
    voucherType,
    voucherNumber: await generateVoucherNumber(voucherType, companyId),
    voucherDate: date || new Date(),
    companyId, entries: lines, totalDebit, totalCredit,
    narration, referenceType, referenceId, referenceNumber
  });
  await voucher.save();
  await updateLedgerBalances(lines, null, companyId);
  return voucher;
};

/** Delete a voucher and undo its ledger balances. Safe on missing ids. */
export const removeVoucher = async (voucherId, companyId) => {
  if (!voucherId) return;
  const v = await Voucher.findOne({ _id: voucherId, companyId });
  if (!v) return;
  await reverseLedgerBalances(v.entries.map(e => e.toObject ? e.toObject() : e), null, companyId);
  await Voucher.deleteOne({ _id: v._id });
};

// ─── Leave balance ───────────────────────────────────────────────────────────
/** Days of an approved/pending leave that fall inside [start, end]. */
const overlapDays = (leave, start, end) => {
  const from = toDay(leave.fromDate) < start ? start : toDay(leave.fromDate);
  const to = toDay(leave.toDate) > end ? toDay(end) : toDay(leave.toDate);
  if (to < from) return 0;
  return Math.round((toDay(to) - toDay(from)) / 86400000) + 1;
};

export const getLeaveBalance = async (employee, year, companyId, excludeLeaveId = null) => {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const q = {
    companyId, employeeId: employee._id,
    status: { $in: ['Approved', 'Pending'] },
    fromDate: { $lte: end }, toDate: { $gte: start }
  };
  if (excludeLeaveId) q._id = { $ne: excludeLeaveId };
  const leaves = await Leave.find(q).lean();

  const quota = employee.leaveQuota || {};
  const types = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory'];
  const result = {};
  for (const t of types) {
    const used = leaves.filter(l => l.leaveType === t && l.status === 'Approved').reduce((s, l) => s + overlapDays(l, start, end), 0);
    const pending = leaves.filter(l => l.leaveType === t && l.status === 'Pending').reduce((s, l) => s + overlapDays(l, start, end), 0);
    const hasQuota = ['Casual', 'Sick', 'Earned'].includes(t);
    const allotted = hasQuota ? (quota[t] ?? 0) : null;
    result[t] = { allotted, used, pending, balance: hasQuota ? allotted - used - pending : null };
  }
  return result;
};

// ─── Payroll computation ─────────────────────────────────────────────────────
/**
 * Build a payroll breakdown for one employee and month.
 * @param {object} opts.overrides  { bonus, arrears, otherDeduction, overtimeHours,
 *                                   loanRecoveries: [{loanId, amount}], remarks }
 * @param {boolean} opts.unmarkedAsAbsent  treat days with no attendance as LOP
 */
export const computePayroll = async ({ employee, month, year, companyId, overrides = {}, unmarkedAsAbsent = false, excludePayrollId = null }) => {
  const { start, end, days } = monthRange(month, year);

  const records = await Attendance.find({
    companyId, employeeId: employee._id, date: { $gte: start, $lte: end }
  }).lean();

  // Employment window inside the month
  const join = employee.joiningDate ? toDay(employee.joiningDate) : null;
  const exit = employee.exitDate ? toDay(employee.exitDate) : null;
  const byDay = new Map(records.map(r => [dayKey(r.date), r]));

  const att = { daysInMonth: days, present: 0, halfDay: 0, absent: 0, paidLeave: 0, unpaidLeave: 0,
    holiday: 0, weekOff: 0, unmarked: 0, notEmployed: 0, lopDays: 0, paidDays: 0 };
  let otHours = 0;

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month - 1, d);
    if ((join && date < join) || (exit && date > exit)) { att.notEmployed++; continue; }
    const rec = byDay.get(dayKey(date));
    if (!rec) { att.unmarked++; continue; }
    otHours += rec.overtimeHours || 0;
    switch (rec.status) {
      case 'Present': att.present++; break;
      case 'Half Day': att.halfDay++; break;
      case 'Absent': att.absent++; break;
      case 'Holiday': att.holiday++; break;
      case 'Week Off': att.weekOff++; break;
      case 'Leave':
        if (rec.leaveType === 'Unpaid') att.unpaidLeave++; else att.paidLeave++;
        break;
      default: att.present++;
    }
  }

  const isDaily = employee.salaryType === 'Daily';
  if (isDaily) {
    // Daily wage: paid only for days worked / paid leave / holidays
    att.paidDays = att.present + att.halfDay * 0.5 + att.paidLeave + att.holiday;
    att.lopDays = days - att.paidDays;
  } else {
    att.lopDays = att.absent + att.halfDay * 0.5 + att.unpaidLeave + att.notEmployed +
      (unmarkedAsAbsent ? att.unmarked : 0);
    att.paidDays = Math.max(0, days - att.lopDays);
  }

  // Earnings
  const s = employee.salaryStructure || {};
  const hasStructure = !isDaily && ((s.basic || 0) + (s.da || 0) + (s.hra || 0) + (s.ta || 0) + (s.otherAllowance || 0)) > 0;
  const factor = days ? att.paidDays / days : 0;
  const earnings = { basic: 0, da: 0, hra: 0, ta: 0, otherAllowance: 0 };
  if (isDaily) {
    earnings.basic = r0((employee.salary || 0) * att.paidDays);
  } else if (hasStructure) {
    for (const k of Object.keys(earnings)) earnings[k] = r0((s[k] || 0) * factor);
  } else {
    earnings.basic = r0((employee.salary || 0) * factor);
  }

  const monthlyGross = isDaily ? (employee.salary || 0) * 26 : (employee.salary || 0);
  const otRate = employee.otRatePerHour > 0
    ? employee.otRatePerHour
    : r2(isDaily ? (employee.salary || 0) / 8 : monthlyGross / days / 8);
  const manualOvertime = overrides.overtimeHours != null && overrides.overtimeHours !== '';
  const overtimeHours = manualOvertime ? Number(overrides.overtimeHours) || 0 : otHours;
  earnings.overtimeHours = overtimeHours;
  earnings.overtimeRate = otRate;
  earnings.overtimeAmount = r0(overtimeHours * otRate);
  earnings.bonus = r0(overrides.bonus);
  earnings.arrears = r0(overrides.arrears);

  const gross = earnings.basic + earnings.da + earnings.hra + earnings.ta + earnings.otherAllowance +
    earnings.overtimeAmount + earnings.bonus + earnings.arrears;

  // Statutory deductions
  const deductions = {
    pf: employee.pfApplicable ? r0((earnings.basic + earnings.da) * (employee.pfPercent ?? 12) / 100) : 0,
    esi: employee.esiApplicable ? Math.ceil(gross * (employee.esiPercent ?? 0.75) / 100) : 0,
    professionalTax: att.paidDays > 0 ? r0(employee.professionalTax) : 0,
    loanRecovery: 0, advanceRecovery: 0,
    other: r0(overrides.otherDeduction)
  };

  // Loan / advance recoveries (EMI), capped at what the salary can bear
  const loans = await Loan.find({ companyId, employeeId: employee._id, status: 'Active' }).sort({ loanDate: 1 }).lean();
  const overrideMap = Array.isArray(overrides.loanRecoveries)
    ? new Map(overrides.loanRecoveries.map(l => [String(l.loanId), Number(l.amount) || 0]))
    : null;
  let room = Math.max(0, gross - deductions.pf - deductions.esi - deductions.professionalTax - deductions.other);
  const loanRecoveries = [];
  const activeLoans = [];
  for (const loan of loans) {
    const remaining = loan.remainingAmount ?? (loan.totalAmount - (loan.paidAmount || 0));
    let suggested = 0;
    if (loan.deductFromSalary !== false) {
      suggested = loan.emiAmount > 0 ? loan.emiAmount : (loan.loanType === 'Advance' ? remaining : 0);
    }
    let amt = overrideMap && overrideMap.has(String(loan._id)) ? overrideMap.get(String(loan._id)) : suggested;
    amt = Math.min(r0(amt), remaining, room);
    amt = Math.max(0, amt);
    room -= amt;
    activeLoans.push({ loanId: loan._id, loanType: loan.loanType, purpose: loan.purpose,
      remaining, emiAmount: loan.emiAmount || 0, suggested, amount: amt });
    if (amt > 0) {
      loanRecoveries.push({ loanId: loan._id, loanType: loan.loanType, amount: amt });
      if (loan.loanType === 'Advance') deductions.advanceRecovery += amt; else deductions.loanRecovery += amt;
    }
  }

  const totalDeductions = deductions.pf + deductions.esi + deductions.professionalTax +
    deductions.loanRecovery + deductions.advanceRecovery + deductions.other;

  return {
    employeeId: employee._id,
    month, year,
    salaryType: isDaily ? 'Daily' : 'Monthly',
    manualOvertime,
    attendanceOvertimeHours: otHours,
    fixedSalary: employee.salary || 0,
    attendance: att,
    earnings,
    deductions,
    loanRecoveries,
    activeLoans,
    grossSalary: r2(gross),
    totalDeductions: r2(totalDeductions),
    netSalary: r2(gross - totalDeductions),
    remarks: overrides.remarks || ''
  };
};

/** Copy a computePayroll() result onto a Payroll document. */
export const applyComputation = (doc, calc) => {
  doc.salaryType = calc.salaryType;
  doc.fixedSalary = calc.fixedSalary;
  doc.attendance = calc.attendance;
  doc.earnings = calc.earnings;
  doc.deductions = calc.deductions;
  doc.loanRecoveries = calc.loanRecoveries;
  doc.manualOvertime = calc.manualOvertime;
  if (calc.remarks !== undefined) doc.remarks = calc.remarks;
  return doc;
};

/** Overrides currently stored on a payroll (to recompute without losing edits). */
export const overridesFromPayroll = (p) => ({
  bonus: p.earnings?.bonus || 0,
  arrears: p.earnings?.arrears || 0,
  otherDeduction: p.deductions?.other || 0,
  // OT follows attendance unless it was typed in by hand
  ...(p.manualOvertime ? { overtimeHours: p.earnings?.overtimeHours } : {}),
  loanRecoveries: (p.loanRecoveries || []).map(l => ({ loanId: l.loanId, amount: l.amount })),
  remarks: p.remarks
});

// ─── Salary payment / reversal ───────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const periodLabel = (m, y) => `${MONTH_NAMES[m - 1]} ${y}`;

/**
 * Pay a payroll: post the Payment voucher and record loan recoveries.
 * `payroll.employeeId` must be populated.
 */
export const paySalary = async (payroll, { paymentMode = 'Cash', bankLedgerId, paidDate }, companyId) => {
  if (payroll.status === 'Paid') throw new Error('Salary already paid');
  const emp = payroll.employeeId;
  const empName = emp?.name || 'Employee';
  const period = periodLabel(payroll.month, payroll.year);
  const date = paidDate ? toDay(paidDate) : new Date();
  const narration = `Salary ${period} — ${empName}${emp?.employeeCode ? ` (${emp.employeeCode})` : ''}`;

  // Re-check loan recoveries against current balances
  const recoveries = [];
  for (const rec of payroll.loanRecoveries || []) {
    if (!rec.amount) continue;
    const loan = await Loan.findOne({ _id: rec.loanId, companyId });
    if (!loan || loan.status === 'Closed') continue;
    const amt = Math.min(rec.amount, loan.remainingAmount);
    if (amt > 0) recoveries.push({ loan, amt });
  }
  const recoveredTotal = recoveries.reduce((s, r) => s + r.amt, 0);
  const plannedTotal = (payroll.deductions?.loanRecovery || 0) + (payroll.deductions?.advanceRecovery || 0);
  if (Math.abs(recoveredTotal - plannedTotal) > 0.01) {
    throw new Error(`Loan balance changed since payroll was processed for ${empName}. Recalculate the payroll and try again.`);
  }

  const gross = payroll.grossSalary || ((payroll.basicSalary || 0) + (payroll.overtime || 0));
  const bonus = payroll.earnings?.bonus || 0;
  const d = payroll.deductions || {};
  const structuredDed = (d.pf || 0) + (d.esi || 0) + (d.professionalTax || 0) + (d.other || 0) + recoveredTotal;
  // Legacy payroll: single "deduction" figure → STAFF RECOVERIES
  const otherDed = structuredDed > 0 ? (d.other || 0) : (payroll.deduction || 0);
  const net = payroll.netSalary;

  const [salaryL, bonusL, pfL, esiL, ptL, otherL, payL] = await Promise.all([
    hrmLedger('salary', companyId), bonus ? hrmLedger('bonus', companyId) : null,
    d.pf ? hrmLedger('pf', companyId) : null, d.esi ? hrmLedger('esi', companyId) : null,
    d.professionalTax ? hrmLedger('pt', companyId) : null, otherDed ? hrmLedger('other', companyId) : null,
    getPayLedger(paymentMode, bankLedgerId, companyId)
  ]);
  const line = (l, dr, cr, n) => l && ({ ledgerId: l._id, ledgerName: l.ledgerName, debitAmount: dr, creditAmount: cr, narration: n });

  const entries = [
    line(salaryL, gross - bonus, 0),
    line(bonusL, bonus, 0),
    line(payL, 0, net),
    line(pfL, 0, d.pf || 0, `PF ${period} — ${empName}`),
    line(esiL, 0, d.esi || 0, `ESI ${period} — ${empName}`),
    line(ptL, 0, d.professionalTax || 0, `Professional tax ${period} — ${empName}`),
    line(otherL, 0, otherDed, `Salary deduction ${period} — ${empName}`)
  ].filter(Boolean);
  for (const { loan, amt } of recoveries) {
    const l = await hrmLedger(loan.loanType === 'Advance' ? 'Advance' : 'Loan', companyId);
    entries.push(line(l, 0, amt, `${loan.loanType} recovery from salary ${period} — ${empName}`));
  }

  const voucher = await postVoucher({
    voucherType: 'Payment', date, companyId, entries, narration,
    referenceType: 'Salary', referenceId: payroll._id, referenceNumber: emp?.employeeCode
  });

  for (const { loan, amt } of recoveries) {
    loan.repayments.push({ date, amount: amt, mode: 'Salary', payrollId: payroll._id, voucherId: voucher?._id,
      remarks: `Salary ${period}` });
    await loan.save();
  }

  payroll.status = 'Paid';
  payroll.paidDate = date;
  payroll.paymentMode = paymentMode;
  payroll.bankLedgerId = paymentMode === 'Bank' ? payL._id : undefined;
  payroll.voucherId = voucher?._id;
  await payroll.save();
  return payroll;
};

/** Undo a salary payment: delete its voucher and the loan recoveries it made. */
export const revertSalaryPayment = async (payroll, companyId) => {
  await removeVoucher(payroll.voucherId, companyId);
  const loans = await Loan.find({ companyId, 'repayments.payrollId': payroll._id });
  for (const loan of loans) {
    loan.repayments = loan.repayments.filter(r => String(r.payrollId) !== String(payroll._id));
    await loan.save();
  }
  payroll.status = 'Approved';
  payroll.paidDate = undefined;
  payroll.voucherId = undefined;
  payroll.paymentMode = undefined;
  payroll.bankLedgerId = undefined;
  await payroll.save();
  return payroll;
};
