import Loan from '../models/Loan.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// ─── Helper: get or create a ledger by name ───────────────────────────────────
const ensureLedger = async (ledgerName, ledgerType, balanceType, companyId) => {
  let ledger = await Ledger.findOne({ ledgerName, companyId });
  if (!ledger) {
    ledger = new Ledger({ ledgerName, ledgerType, companyId, openingBalance: 0, currentBalance: 0, openingBalanceType: balanceType, status: 'Active' });
    await ledger.save();
  }
  return ledger;
};

// ─── Helper: get Cash in Hand ledger ──────────────────────────────────────────
const getCashLedger = async (companyId) => {
  let ledger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active', companyId });
  if (!ledger) ledger = await ensureLedger('Cash in Hand', 'Cash', 'Dr', companyId);
  return ledger;
};

// ─── Helper: get Employee Loan or Advance ledger ──────────────────────────────
const getLoanLedger = async (loanType, companyId) => {
  const name = loanType === 'Advance' ? 'Employee Advance A/c' : 'Employee Loan A/c';
  return ensureLedger(name, 'Other Receivable', 'Dr', companyId);
};

// Add loan
export const addLoan = async (req, res) => {
  try {
    const { employeeId, totalAmount, purpose, loanType = 'Loan', loanDate } = req.body;
    const companyId = req.companyId;

    const loan = new Loan({
      companyId,
      employeeId,
      loanType,
      loanDate: loanDate ? new Date(loanDate) : new Date(),
      totalAmount,
      paidAmount: 0,
      purpose
    });
    await loan.save();
    await loan.populate('employeeId', 'name department role');

    // ── Create Payment voucher (cash going out) ────────────────────────────
    try {
      const cashLedger = await getCashLedger(companyId);
      const loanLedger = await getLoanLedger(loanType, companyId);
      const amt = parseFloat(totalAmount);
      const empName = loan.employeeId?.name || 'Employee';
      const narration = `${loanType} disbursed to ${empName}${purpose ? ' — ' + purpose : ''}`;

      const entries = [
        { ledgerId: loanLedger._id, ledgerName: loanLedger.ledgerName, debitAmount: amt,  creditAmount: 0, narration },
        { ledgerId: cashLedger._id,  ledgerName: cashLedger.ledgerName,  debitAmount: 0,   creditAmount: amt, narration },
      ];
      const voucherType = loanType === 'Advance' ? 'AdvancePayment' : 'LoanDisbursal';
      const voucher = new Voucher({
        voucherType,
        voucherNumber: await generateVoucherNumber(voucherType, companyId),
        voucherDate:   loan.loanDate,
        companyId,
        entries,
        totalDebit:    amt,
        totalCredit:   amt,
        narration,
        referenceType: 'LoanDisbursal',
        referenceId:   loan._id,
      });
      await voucher.save();
      await updateLedgerBalances(entries, null, companyId);
      loan.disbursalVoucherId = voucher._id;
      await loan.save();
    } catch (vErr) {
      console.error('Loan voucher creation failed:', vErr.message);
    }

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
    if (status)     query.status     = status;
    if (loanType)   query.loanType   = loanType;

    const loans = await Loan.find(query)
      .populate('employeeId', 'name department role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: loans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get loan by ID
export const getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('employeeId', 'name department role');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update loan
export const updateLoan = async (req, res) => {
  try {
    const { totalAmount, purpose } = req.body;
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { totalAmount, purpose },
      { new: true, runValidators: true }
    ).populate('employeeId', 'name department role');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete loan
export const deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    res.json({ success: true, message: 'Loan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Make a payment / deduct from loan
export const makePayment = async (req, res) => {
  try {
    const { amount } = req.body;
    const companyId = req.companyId;
    const loan = await Loan.findOne({ _id: req.params.id, companyId })
      .populate('employeeId', 'name department role');
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.status === 'Closed') return res.status(400).json({ success: false, message: 'Loan already closed' });

    loan.paidAmount = (loan.paidAmount || 0) + parseFloat(amount);
    await loan.save(); // pre-save hook recalculates remainingAmount and status

    // ── Create Receipt voucher (cash coming in) ────────────────────────────
    try {
      const cashLedger = await getCashLedger(companyId);
      const loanLedger = await getLoanLedger(loan.loanType, companyId);
      const amt = parseFloat(amount);
      const empName = loan.employeeId?.name || 'Employee';
      const narration = `${loan.loanType} recovery from ${empName}${loan.purpose ? ' — ' + loan.purpose : ''}`;

      const entries = [
        { ledgerId: cashLedger._id,  ledgerName: cashLedger.ledgerName,  debitAmount: amt, creditAmount: 0, narration },
        { ledgerId: loanLedger._id, ledgerName: loanLedger.ledgerName, debitAmount: 0, creditAmount: amt,  narration },
      ];
      const voucher = new Voucher({
        voucherType:   'Receipt',
        voucherNumber: await generateVoucherNumber('Receipt', companyId),
        voucherDate:   new Date(),
        companyId,
        entries,
        totalDebit:    amt,
        totalCredit:   amt,
        narration,
        referenceType: 'Payment',
        referenceId:   loan._id,
      });
      await voucher.save();
      await updateLedgerBalances(entries, null, companyId);
    } catch (vErr) {
      console.error('Loan repayment voucher failed:', vErr.message);
    }

    res.json({ success: true, data: loan });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
