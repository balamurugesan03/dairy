/**
 * Shared bits for the HRM screens: month/year options, money formatting,
 * status colours, bank-ledger loader, stat card, and the A4 payslip /
 * salary-register / attendance-register prints.
 */
import { useEffect, useState } from 'react';
import { ledgerAPI } from '../../services/api';
import { openA4Print, a4Header, a4Signatures, escapeHtml } from '../../utils/printA4';
import { amountInWords } from '../../utils/voucherPrint';

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, i) => ({ value: String(i + 1), label }));

export const monthName = (m, short = false) => {
  const l = MONTHS[Number(m) - 1]?.label || '';
  return short ? l.slice(0, 3) : l;
};
export const periodLabel = (m, y) => `${monthName(m, true)} ${y}`;

export const yearOptions = (back = 5, ahead = 1) => {
  const now = new Date().getFullYear();
  const out = [];
  for (let y = now + ahead; y >= now - back; y--) out.push({ value: String(y), label: String(y) });
  return out;
};

export const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const num = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export const DEPARTMENTS = ['Administration', 'Procurement', 'Dairy', 'Finance', 'Sales', 'Transport', 'Production', 'HR', 'IT', 'Operations'];
export const ROLES = ['Secretary', 'Manager', 'Supervisor', 'Accountant', 'Clerk', 'Milk Tester', 'Operator', 'Driver', 'Helper', 'Sales Staff', 'Other'];
export const EMPLOYMENT_TYPES = ['Permanent', 'Temporary', 'Contract', 'Daily Wage'];
export const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Maternity', 'Paternity', 'Unpaid', 'Compensatory'];
export const QUOTA_TYPES = ['Casual', 'Sick', 'Earned'];

export const ATTENDANCE = {
  Present: { code: 'P', color: 'green' },
  Absent: { code: 'A', color: 'red' },
  'Half Day': { code: 'H', color: 'yellow' },
  Leave: { code: 'L', color: 'blue' },
  Holiday: { code: 'HD', color: 'grape' },
  'Week Off': { code: 'WO', color: 'gray' }
};
export const ATTENDANCE_STATUSES = Object.keys(ATTENDANCE);

export const payrollStatusColor = (s) => ({ Pending: 'yellow', Approved: 'indigo', Paid: 'green' }[s] || 'gray');
export const leaveStatusColor = (s) => ({ Pending: 'yellow', Approved: 'green', Rejected: 'red', Cancelled: 'gray' }[s] || 'gray');
export const leaveTypeColor = (t) => ({
  Casual: 'blue', Sick: 'red', Earned: 'green', Maternity: 'grape',
  Paternity: 'indigo', Unpaid: 'gray', Compensatory: 'orange'
}[t] || 'gray');

/** Active bank ledgers as Select options. */
export const useBankLedgers = () => {
  const [banks, setBanks] = useState([]);
  useEffect(() => {
    Promise.all([
      ledgerAPI.getAll({ ledgerType: 'Bank', status: 'Active', limit: 200 }).catch(() => ({})),
      ledgerAPI.getAll({ ledgerType: 'Bank Accounts', status: 'Active', limit: 200 }).catch(() => ({}))
    ]).then(([a, b]) => {
      const all = [...(a?.data || []), ...(b?.data || [])];
      const uniq = all.filter((l, i) => all.findIndex(x => x._id === l._id) === i);
      setBanks(uniq.map(l => ({ value: l._id, label: l.ledgerName })));
    });
  }, []);
  return banks;
};

/** Total gross for any payroll record (legacy records have no grossSalary). */
export const grossOf = (p) => p.grossSalary || ((p.basicSalary || 0) + (p.overtime || 0));

/** Earnings / deduction lines of a payroll for display & print. */
export const payrollLines = (p) => {
  const e = p.earnings || {};
  const d = p.deductions || {};
  const structured = e.basic || e.da || e.hra || e.ta || e.otherAllowance || e.overtimeAmount || e.bonus || e.arrears;
  const earnings = structured ? [
    ['Basic', e.basic], ['DA', e.da], ['HRA', e.hra], ['TA / Conveyance', e.ta], ['Other Allowance', e.otherAllowance],
    [`Overtime${e.overtimeHours ? ` (${num(e.overtimeHours)} h × ${num(e.overtimeRate)})` : ''}`, e.overtimeAmount],
    ['Bonus / Incentive', e.bonus], ['Arrears', e.arrears]
  ] : [['Basic Salary', p.basicSalary], ['Overtime', p.overtime]];
  const deductions = structured ? [
    ['Provident Fund', d.pf], ['ESI', d.esi], ['Professional Tax', d.professionalTax],
    ['Loan Recovery', d.loanRecovery], ['Advance Recovery', d.advanceRecovery], ['Other Deduction', d.other]
  ] : [['Deduction', p.deduction]];
  return {
    earnings: earnings.filter(([, v]) => v),
    deductions: deductions.filter(([, v]) => v)
  };
};

// ─── Prints ──────────────────────────────────────────────────────────────────
const PAYSLIP_CSS = `
  .slip { page-break-after: always; break-after: page; }
  .slip:last-child { page-break-after: auto; break-after: auto; }
  .kv { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
  .kv td { padding: 3px 5px; border: 0.75px solid #444; }
  .kv td.k { background: #f0f0f0; font-weight: 700; width: 17%; }
  .net { margin-top: 8px; border: 1.5px solid #000; padding: 6px 8px; font-size: 12px; display: flex; justify-content: space-between; font-weight: 700; }
  .words { font-size: 9.5px; margin-top: 4px; font-style: italic; }
  table.a4 td { font-size: 10px; }
`;

const payslipHtml = (p, orgName) => {
  const emp = p.employeeId || {};
  const a = p.attendance || {};
  const { earnings, deductions } = payrollLines(p);
  const rows = Math.max(earnings.length, deductions.length);
  let body = '';
  for (let i = 0; i < rows; i++) {
    const [el, ev] = earnings[i] || ['', ''];
    const [dl, dv] = deductions[i] || ['', ''];
    body += `<tr><td>${escapeHtml(el)}</td><td class="amt">${ev !== '' ? num(ev) : ''}</td>
      <td class="split">${escapeHtml(dl)}</td><td class="amt">${dv !== '' ? num(dv) : ''}</td></tr>`;
  }
  const kv = (k, v) => `<td class="k">${escapeHtml(k)}</td><td>${escapeHtml(v ?? '-')}</td>`;
  return `<div class="slip">
    ${a4Header({ orgName, title: 'Pay Slip', period: periodLabel(p.month, p.year), extra: p.status === 'Paid' ? `Paid on ${fmtDate(p.paidDate)}` : p.status })}
    <table class="kv">
      <tr>${kv('Emp Code', emp.employeeCode)}${kv('Name', emp.name)}${kv('Department', emp.department)}</tr>
      <tr>${kv('Designation', emp.role)}${kv('Joining', fmtDate(emp.joiningDate))}${kv('Pay Mode', p.paymentMode || emp.paymentMode || 'Cash')}</tr>
      <tr>${kv('Bank A/c', emp.accountNo ? `${emp.bankName || ''} ${emp.accountNo}` : '-')}${kv('PF No', emp.pfNumber)}${kv('ESI No', emp.esiNumber)}</tr>
    </table>
    <table class="kv">
      <tr>${kv('Days in Month', a.daysInMonth || '-')}${kv('Paid Days', a.paidDays ?? '-')}${kv('LOP Days', a.lopDays ?? 0)}</tr>
      <tr>${kv('Present', a.present ?? '-')}${kv('Leave (paid)', a.paidLeave ?? 0)}${kv('Absent / Half', `${a.absent ?? 0} / ${a.halfDay ?? 0}`)}</tr>
    </table>
    <table class="a4">
      <thead><tr><th style="width:32%">Earnings</th><th style="width:18%">Amount</th><th class="split" style="width:32%">Deductions</th><th style="width:18%">Amount</th></tr></thead>
      <tbody>${body}
        <tr class="row-grand"><td>Gross Earnings</td><td class="amt">${num(grossOf(p))}</td>
          <td class="split">Total Deductions</td><td class="amt">${num(p.deduction)}</td></tr>
      </tbody>
    </table>
    <div class="net"><span>NET PAY</span><span>₹ ${num(p.netSalary)}</span></div>
    <div class="words">${escapeHtml(amountInWords(p.netSalary || 0))}</div>
    ${p.remarks ? `<div class="words">Remarks: ${escapeHtml(p.remarks)}</div>` : ''}
    ${a4Signatures(['Employee', 'Secretary', 'President'])}
  </div>`;
};

/** Print one or many payslips (one per A4 page). */
export const printPayslips = (payrolls, orgName) => {
  if (!payrolls?.length) return;
  openA4Print({
    title: payrolls.length === 1 ? `Payslip ${payrolls[0].employeeId?.name || ''}` : 'Payslips',
    bodyHtml: payrolls.map(p => payslipHtml(p, orgName)).join(''),
    css: PAYSLIP_CSS
  });
};

/** Salary register (landscape) for a month. */
export const printSalaryRegister = (payrolls, { orgName, month, year }) => {
  const sum = (f) => payrolls.reduce((s, p) => s + (Number(f(p)) || 0), 0);
  const cols = [
    ['Basic', p => p.earnings?.basic || p.basicSalary], ['DA', p => p.earnings?.da], ['HRA', p => p.earnings?.hra],
    ['TA', p => p.earnings?.ta], ['Other', p => p.earnings?.otherAllowance], ['OT', p => p.earnings?.overtimeAmount || p.overtime],
    ['Bonus', p => (p.earnings?.bonus || 0) + (p.earnings?.arrears || 0)], ['Gross', grossOf],
    ['PF', p => p.deductions?.pf], ['ESI', p => p.deductions?.esi], ['PT', p => p.deductions?.professionalTax],
    ['Loan/Adv', p => (p.deductions?.loanRecovery || 0) + (p.deductions?.advanceRecovery || 0)],
    ['Other Ded', p => p.deductions?.other ?? (p.earnings ? 0 : p.deduction)], ['Total Ded', p => p.deduction], ['Net Pay', p => p.netSalary]
  ];
  const head = `<tr><th style="width:3%">#</th><th style="width:6%">Code</th><th style="width:13%">Employee</th>
    <th style="width:4%">Paid Days</th>${cols.map(([h]) => `<th>${h}</th>`).join('')}<th style="width:8%">Signature</th></tr>`;
  const body = payrolls.map((p, i) => `<tr>
    <td class="ctr">${i + 1}</td><td>${escapeHtml(p.employeeId?.employeeCode || '')}</td>
    <td>${escapeHtml(p.employeeId?.name || '')}<div class="narr">${escapeHtml(p.employeeId?.role || '')}</div></td>
    <td class="ctr">${p.attendance?.paidDays ?? '-'}</td>
    ${cols.map(([, f]) => `<td class="amt">${num(f(p))}</td>`).join('')}<td></td></tr>`).join('');
  const total = `<tr class="row-grand"><td colspan="4">TOTAL (${payrolls.length})</td>${cols.map(([, f]) => `<td class="amt">${num(sum(f))}</td>`).join('')}<td></td></tr>`;
  openA4Print({
    title: `Salary Register ${periodLabel(month, year)}`,
    orientation: 'landscape',
    bodyHtml: `${a4Header({ orgName, title: 'Salary Register', period: `${monthName(month)} ${year}` })}
      <table class="a4"><thead>${head}</thead><tbody>${body}${total}</tbody></table>
      ${a4Signatures(['Prepared By', 'Secretary', 'President'], new Date().toLocaleString('en-IN'))}`
  });
};

/** Monthly attendance register (landscape). */
export const printAttendanceRegister = (register, orgName) => {
  const { month, year, daysInMonth, rows } = register;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dow = (d) => new Date(year, month - 1, d).toLocaleDateString('en-IN', { weekday: 'narrow' });
  const head = `<tr><th style="width:3%">#</th><th style="width:12%">Employee</th>
    ${days.map(d => `<th style="padding:1px">${d}<div style="font-weight:400">${dow(d)}</div></th>`).join('')}
    <th>P</th><th>A</th><th>H</th><th>L</th><th>OT</th></tr>`;
  const body = rows.map((r, i) => `<tr><td class="ctr">${i + 1}</td>
    <td>${escapeHtml(r.employee.name)}<div class="narr">${escapeHtml(r.employee.employeeCode || '')}</div></td>
    ${days.map(d => `<td class="ctr" style="padding:1px;font-size:8px">${r.days[d] ? ATTENDANCE[r.days[d].status]?.code || '' : ''}</td>`).join('')}
    <td class="ctr b">${r.summary.present}</td><td class="ctr">${r.summary.absent}</td><td class="ctr">${r.summary.halfDay}</td>
    <td class="ctr">${r.summary.leave}</td><td class="ctr">${num(r.summary.overtimeHours)}</td></tr>`).join('');
  openA4Print({
    title: `Attendance Register ${periodLabel(month, year)}`,
    orientation: 'landscape',
    bodyHtml: `${a4Header({ orgName, title: 'Attendance Register', period: `${monthName(month)} ${year}`,
      extra: 'P Present · A Absent · H Half Day · L Leave · HD Holiday · WO Week Off' })}
      <table class="a4"><thead>${head}</thead><tbody>${body}</tbody></table>
      ${a4Signatures(['Prepared By', 'Secretary'], new Date().toLocaleString('en-IN'))}`
  });
};
