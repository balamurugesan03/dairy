import Loan from '../models/Loan.js';
import Employee from '../models/Employee.js';
import Voucher from '../models/Voucher.js';
import { hrmLedger, getPayLedger, postVoucher, removeVoucher, toDay, r2 } from '../utils/hrmEngine.js';

const POPULATE = 'name employeeCode department role';

/** Disbursal: Dr Employee Loan/Advance A/c, Cr Cash/Bank */
const postDisbursal = async (loan, empName, bankLedgerId, companyId) => {
  const loanL = await hrmLedger(loan.loanType === 'Advance' ? 'Advance' : 'Loan', companyId);
  const payL = await getPayLedger(loan.disbursalMode, bankLedgerId, companyId);
  const narration = `${loan.loanType} disbursed to ${empName}${loan.purpose ? ' — ' + loan.purpose : ''}`;
  const voucherType = loan.loanType === 'Advance' ? 'AdvancePayment' : 'LoanDisbursal';
  return postVoucher({
    voucherType, date: loan.loanDate, companyId, narration,
    referenceType: 'LoanDisbursal', referenceId: loan._id,
    entries: [
      { ledgerId: loanL._id, ledgerName: loanL.ledgerName, debitAmount: loan.totalAmount, creditAmount: 0 },
      { ledgerId: payL._id, ledgerName: payL.ledgerName, debitAmount: 0, creditAmount: loan.totalAmount }
    ]
  });
};

// Add loan / advance
export const addLoan = async (req, res) => {
  try {
    const { employeeId, totalAmount, purpose, loanType = 'Loan', loanDate, emiAmount = 0,
      deductFromSalary = true, disbursalMode = 'Cash', bankLedgerId } = req.body;
    const companyId = req.companyId;
    const amount = r2(totalAmount);
    if (!employeeId || amount <= 0) return res.status(400).json({ success: false, message: 'Employee and a positive amount are required' });
    const employee = await Employee.findOne({ _id: employeeId, companyId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (Number(emiAmount) > amount) return res.status(400).json({ success: false, message: 'Instalment cannot exceed the amount' });

    const loan = new Loan({
      companyId, employeeId, loanType,
      loanDate: loanDate ? toDay(loanDate) : new Date(),
      totalAmount: amount, emiAmount: r2(emiAmount), deductFromSalary, purpose, disbursalMode
    });
    await loan.save();

    const voucher = await postDisbursal(loan, employee.name, bankLedgerId, companyId);
    loan.disbursalVoucherId = voucher?._id;
    await loan.save();
    await loan.populate('employeeId', POPULATE);
    res.status(201).json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all loans
export const getAllLoans = async (req, res) => {
  try {
    const { employeeId, status, loanType } = req.query;
    const query = { companyId: req.companyId };
    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;
    if (loanType) query.loanType = loanType;

    const loans = await Loan.find(query)
      .populate('employeeId', POPULATE)
      .populate('disbursalVoucherId', 'voucherNumber')
      .sort({ loanDate: -1, createdAt: -1 });
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get loan by ID (with repayment history)
export const getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', POPULATE)
      .populate('disbursalVoucherId', 'voucherNumber voucherDate')
      .populate('repayments.voucherId', 'voucherNumber');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update loan — purpose / EMI / salary deduction always; amount & date only before any recovery
export const updateLoan = async (req, res) => {
  try {
    const companyId = req.companyId;
    const loan = await Loan.findOne({ _id: req.params.id, companyId }).populate('employeeId', POPULATE);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    const { totalAmount, purpose, emiAmount, deductFromSalary, loanDate } = req.body;

    if (purpose !== undefined) loan.purpose = purpose;
    if (emiAmount !== undefined) loan.emiAmount = r2(emiAmount);
    if (deductFromSalary !== undefined) loan.deductFromSalary = !!deductFromSalary;

    const amountChanged = totalAmount !== undefined && r2(totalAmount) !== loan.totalAmount;
    const dateChanged = loanDate && toDay(loanDate).getTime() !== toDay(loan.loanDate).getTime();
    if (amountChanged || dateChanged) {
      if ((loan.repayments || []).length || (loan.legacyPaid || 0) > 0) {
        return res.status(400).json({ success: false, message: 'Amount/date cannot change after recoveries have been made' });
      }
      if (amountChanged) {
        if (r2(totalAmount) <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });
        loan.totalAmount = r2(totalAmount);
      }
      if (dateChanged) loan.loanDate = toDay(loanDate);
      // Re-post the disbursal voucher with the new figures
      await removeVoucher(loan.disbursalVoucherId, companyId);
      const v = await postDisbursal(loan, loan.employeeId?.name || 'Employee', req.body.bankLedgerId, companyId);
      loan.disbursalVoucherId = v?._id;
    }
    await loan.save();
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete loan — reverses disbursal + cash/bank recovery vouchers
export const deleteLoan = async (req, res) => {
  try {
    const companyId = req.companyId;
    const loan = await Loan.findOne({ _id: req.params.id, companyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if ((loan.repayments || []).some(r => r.mode === 'Salary')) {
      return res.status(400).json({ success: false, message: 'Loan has recoveries through salary. Revert those salary payments before deleting.' });
    }
    for (const r of loan.repayments || []) await removeVoucher(r.voucherId, companyId);
    await removeVoucher(loan.disbursalVoucherId, companyId);
    // Recoveries posted before repayment history existed (referenceType 'Payment')
    const legacy = await Voucher.find({ companyId, referenceId: loan._id, referenceType: 'Payment' }, '_id').lean();
    for (const v of legacy) await removeVoucher(v._id, companyId);
    await loan.deleteOne();
    res.json({ success: true, message: 'Loan deleted and accounts reversed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Direct recovery (cash / bank): Dr Cash/Bank, Cr Employee Loan/Advance A/c
export const makePayment = async (req, res) => {
  try {
    const { amount, date, mode = 'Cash', bankLedgerId, remarks } = req.body;
    const companyId = req.companyId;
    const loan = await Loan.findOne({ _id: req.params.id, companyId }).populate('employeeId', POPULATE);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status === 'Closed') return res.status(400).json({ success: false, message: 'Loan already closed' });
    const amt = r2(amount);
    if (amt <= 0) return res.status(400).json({ success: false, message: 'Enter a valid amount' });
    if (amt > loan.remainingAmount + 0.01) {
      return res.status(400).json({ success: false, message: `Amount exceeds the balance of ₹${loan.remainingAmount}` });
    }

    const payDate = date ? toDay(date) : new Date();
    const loanL = await hrmLedger(loan.loanType === 'Advance' ? 'Advance' : 'Loan', companyId);
    const payL = await getPayLedger(mode, bankLedgerId, companyId);
    const empName = loan.employeeId?.name || 'Employee';
    const narration = `${loan.loanType} recovery from ${empName}${loan.purpose ? ' — ' + loan.purpose : ''}`;
    const voucher = await postVoucher({
      voucherType: 'Receipt', date: payDate, companyId, narration,
      referenceType: 'EmployeeLoan', referenceId: loan._id,
      entries: [
        { ledgerId: payL._id, ledgerName: payL.ledgerName, debitAmount: amt, creditAmount: 0 },
        { ledgerId: loanL._id, ledgerName: loanL.ledgerName, debitAmount: 0, creditAmount: amt }
      ]
    });

    loan.repayments.push({ date: payDate, amount: amt, mode, voucherId: voucher?._id, remarks });
    await loan.save();
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Remove a cash/bank recovery (salary recoveries are undone from Payroll)
export const deleteRepayment = async (req, res) => {
  try {
    const companyId = req.companyId;
    const loan = await Loan.findOne({ _id: req.params.id, companyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    const rep = loan.repayments.id(req.params.repaymentId);
    if (!rep) return res.status(404).json({ success: false, message: 'Recovery not found' });
    if (rep.mode === 'Salary') {
      return res.status(400).json({ success: false, message: 'This recovery came from salary — revert that salary payment in Payroll' });
    }
    await removeVoucher(rep.voucherId, companyId);
    rep.deleteOne();
    await loan.save();
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
