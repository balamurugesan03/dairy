import ProducerLoan from '../models/ProducerLoan.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import EarningDeduction from '../models/EarningDeduction.js';
import mongoose from 'mongoose';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// Create a new producer loan
export const createLoan = async (req, res) => {
  try {
    const loanData = req.body;
    loanData.companyId = req.userCompany;
    loanData.createdBy = req.user?._id;

    // Calculate interest based on type
    if (loanData.interestType === 'Percentage' && loanData.interestRate > 0) {
      loanData.interestAmount = (loanData.principalAmount * loanData.interestRate) / 100;
    } else if (loanData.interestType === 'Flat') {
      // interestAmount is already set in the request
    } else {
      loanData.interestAmount = 0;
    }

    // Calculate total loan amount
    loanData.totalLoanAmount = loanData.principalAmount + (loanData.interestAmount || 0);

    // Calculate EMI
    if (loanData.totalEMI > 0) {
      loanData.emiAmount = Math.ceil(loanData.totalLoanAmount / loanData.totalEMI);
    }

    const loan = new ProducerLoan(loanData);
    await loan.save();

    // Create disbursement voucher
    try {
      const voucher = await createLoanDisbursementVoucher(loan, req.userCompany);
      if (voucher) {
        loan.voucherId = voucher._id;
        await loan.save();
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
      // Continue without voucher - don't fail the loan creation
    }
    // Populate farmer details for response
    await loan.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      data: loan
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating loan'
    });
  } finally {
  }
};

// Create loan disbursement voucher
// CASH  → Payment voucher: Dr "Farmer Loan A/C" / Cr Cash
//          → appears in Cash Book (cash column) and Day Book (cash column, payment side)
// BANK/OTHER → Payment voucher (referenceType:'BankTransfer'): Dr "Farmer Loan A/C" / Cr <bank ledger>
//          → appears in Day Book only (adjustment column: income=bank, expenditure=Farmer Loan A/C)
const createLoanDisbursementVoucher = async (loan, companyId) => {
  const FARMER_LOAN_LEDGER = 'Farmer Loan A/C';

  // Ensure "Farmer Loan A/C" ledger exists
  let loanLedger = await Ledger.findOne({ ledgerName: FARMER_LOAN_LEDGER, companyId });
  if (!loanLedger) {
    loanLedger = new Ledger({
      ledgerName: FARMER_LOAN_LEDGER,
      ledgerType: 'Advance due by Society',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Dr',
      status: 'Active',
    });
    await loanLedger.save();
  }

  const isCash = loan.paymentMode === 'Cash';
  let paymentLedger = null;

  if (isCash) {
    paymentLedger = await Ledger.findOne({ ledgerType: { $in: ['Cash', 'Cash in Hand'] }, status: 'Active', companyId });
  } else if (loan.bankLedgerId) {
    paymentLedger = await Ledger.findById(loan.bankLedgerId);
  } else {
    // Fallback: first active Bank ledger
    paymentLedger = await Ledger.findOne({ ledgerType: { $in: ['Bank', 'Bank Accounts'] }, status: 'Active', companyId });
  }

  if (!paymentLedger) throw new Error('Payment ledger not found. Please ensure a Cash or Bank ledger exists.');

  const entries = [
    {
      ledgerId: loanLedger._id,
      ledgerName: loanLedger.ledgerName,
      debitAmount: loan.principalAmount,
      creditAmount: 0,
    },
    {
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: 0,
      creditAmount: loan.principalAmount,
    },
  ];

  const voucherNumber = await generateVoucherNumber('Payment', companyId);

  const voucher = new Voucher({
    voucherType: 'Payment',
    voucherNumber,
    voucherDate: loan.loanDate,
    companyId,
    entries,
    totalDebit: loan.principalAmount,
    totalCredit: loan.principalAmount,
    narration: `Farmer Loan Disbursement — ${loan.loanType} — ${loan.loanNumber}`,
    referenceType: isCash ? 'LoanDisbursal' : 'BankTransfer',
    referenceId: loan._id,
  });

  await voucher.save();
  await updateLedgerBalances(entries, null, companyId);

  return voucher;
};

// Get all loans with filters
export const getAllLoans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      status = '',
      loanType = '',
      fromDate = '',
      toDate = '',
      sortBy = 'loanDate',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    if (req.userCompany) query.companyId = new mongoose.Types.ObjectId(req.userCompany);
    if (farmerId) query.farmerId = new mongoose.Types.ObjectId(farmerId);
    if (status) query.status = status;
    if (loanType) query.loanType = loanType;

    if (fromDate || toDate) {
      query.loanDate = {};
      if (fromDate) query.loanDate.$gte = new Date(fromDate);
      if (toDate) query.loanDate.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const loans = await ProducerLoan.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails')
      .populate('createdBy', 'name');

    const total = await ProducerLoan.countDocuments(query);

    // Calculate summary - build aggregation match query
    const aggregateQuery = { status: { $in: ['Active', 'Defaulted'] } };
    if (req.userCompany) aggregateQuery.companyId = new mongoose.Types.ObjectId(req.userCompany);

    const summary = await ProducerLoan.aggregate([
      { $match: aggregateQuery },
      {
        $group: {
          _id: null,
          totalDisbursed: { $sum: '$disbursedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalRecovered: { $sum: '$recoveredAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: loans,
      summary: summary[0] || { totalDisbursed: 0, totalOutstanding: 0, totalRecovered: 0, count: 0 },
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching loans'
    });
  }
};

// Get single loan by ID
export const getLoanById = async (req, res) => {
  try {
    const loan = await ProducerLoan.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('farmerId', 'farmerNumber personalDetails bankDetails address')
      .populate('createdBy', 'name')
      .populate('cancelledBy', 'name')
      .populate('closedBy', 'name')
      .populate('emiSchedule.paymentId', 'paymentNumber paymentDate');

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    res.status(200).json({
      success: true,
      data: loan
    });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching loan'
    });
  }
};

// Get farmer's loans
export const getFarmerLoans = async (req, res) => {
  try {
    const { status = '', includeCompleted = 'false' } = req.query;

    const query = { farmerId: req.params.farmerId };

    if (status) {
      query.status = status;
    } else if (includeCompleted === 'false') {
      query.status = { $in: ['Active', 'Defaulted'] };
    }

    const loans = await ProducerLoan.find(query)
      .sort({ loanDate: -1 })
      .populate('createdBy', 'name');

    // Get total outstanding by type
    const outstandingByType = await ProducerLoan.getFarmerOutstandingByType(req.params.farmerId);

    // Get overall outstanding
    const outstanding = await ProducerLoan.getFarmerOutstanding(req.params.farmerId);

    res.status(200).json({
      success: true,
      data: loans,
      outstanding,
      outstandingByType
    });
  } catch (error) {
    console.error('Error fetching farmer loans:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer loans'
    });
  }
};

// Update loan — full edit while nothing has been recovered yet.
// Financial fields (amount/interest/EMI count/scheme/date) are safe to change
// wholesale and regenerate the EMI schedule from scratch because the
// hasPaidEMI guard below already proves every EMI row is still untouched
// (paidAmount === 0). Fields that affect the disbursement voucher
// (principal/payment mode/bank ledger/date) trigger a reverse-and-repost so
// the ledgers stay in sync with the edited loan.
export const updateLoan = async (req, res) => {
  try {
    const loan = await ProducerLoan.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    // Check if any EMI has been paid
    const hasPaidEMI = loan.emiSchedule.some(emi => emi.paidAmount > 0);

    if (hasPaidEMI) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update loan after EMI payments have been made'
      });
    }

    if (loan.status === 'Closed' || loan.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a closed or cancelled loan'
      });
    }

    const FIELDS = [
      'loanDate', 'loanType', 'loanScheme', 'principalAmount',
      'interestType', 'interestRate', 'interestAmount', 'totalEMI',
      'paymentMode', 'bankLedgerId', 'chequeNumber',
      'guarantorName', 'guarantorPhone', 'purpose', 'remarks',
    ];
    const FINANCIAL_FIELDS = ['loanDate', 'loanScheme', 'principalAmount', 'interestType', 'interestRate', 'interestAmount', 'totalEMI'];
    const VOUCHER_FIELDS   = ['loanDate', 'principalAmount', 'paymentMode', 'bankLedgerId'];

    let financialChanged = false;
    let voucherChanged   = false;

    for (const field of FIELDS) {
      if (req.body[field] === undefined) continue;
      const newValue = field === 'loanDate' ? new Date(req.body[field]) : req.body[field];
      const oldValue = loan[field];
      const changed  = field === 'loanDate'
        ? (oldValue ? new Date(oldValue).getTime() : null) !== newValue.getTime()
        : String(oldValue ?? '') !== String(newValue ?? '');

      if (changed) {
        if (FINANCIAL_FIELDS.includes(field)) financialChanged = true;
        if (VOUCHER_FIELDS.includes(field))   voucherChanged   = true;
      }
      loan[field] = newValue;
    }

    if (financialChanged) {
      // Recompute interest / total / EMI amount (same math as the pre-save hook)
      if (loan.interestType === 'Percentage' && loan.interestRate > 0) {
        loan.interestAmount = (loan.principalAmount * loan.interestRate) / 100;
      } else if (loan.interestType !== 'Flat') {
        loan.interestAmount = 0;
      }
      loan.totalLoanAmount = loan.principalAmount + (loan.interestAmount || 0);
      if (loan.totalEMI > 0) {
        loan.emiAmount = Math.ceil(loan.totalLoanAmount / loan.totalEMI);
      }

      // Regenerate the EMI schedule from scratch — safe because hasPaidEMI
      // above proved no installment has been touched yet.
      const schedule  = [];
      const startDate = new Date(loan.loanDate);
      for (let i = 1; i <= loan.totalEMI; i++) {
        const dueDate = new Date(startDate);
        if (loan.loanScheme !== 'Cycle') dueDate.setMonth(dueDate.getMonth() + i);
        const emiAmt = i === loan.totalEMI
          ? loan.totalLoanAmount - (loan.emiAmount * (loan.totalEMI - 1))
          : loan.emiAmount;
        schedule.push({ emiNumber: i, dueDate, amount: emiAmt, paidAmount: 0, status: 'Pending' });
      }
      loan.emiSchedule       = schedule;
      loan.disbursedAmount   = loan.principalAmount;
      loan.outstandingAmount = loan.totalLoanAmount;
      loan.recoveredAmount   = 0;
    }

    // Re-post the disbursement voucher if amount / payment mode / bank / date changed
    if (voucherChanged) {
      if (loan.voucherId) {
        const oldVoucher = await Voucher.findById(loan.voucherId);
        if (oldVoucher && oldVoucher.status !== 'Cancelled') {
          const reversedEntries = oldVoucher.entries.map(e => ({
            ledgerId: e.ledgerId,
            ledgerName: e.ledgerName,
            debitAmount: e.creditAmount,
            creditAmount: e.debitAmount,
          }));
          await updateLedgerBalances(reversedEntries, null, req.companyId);
          oldVoucher.status = 'Cancelled';
          await oldVoucher.save();
        }
      }
      try {
        const newVoucher = await createLoanDisbursementVoucher(loan, req.companyId);
        loan.voucherId = newVoucher._id;
      } catch (voucherError) {
        console.error('Voucher re-creation failed on loan update:', voucherError);
      }
    }

    await loan.save();
    await loan.populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Loan updated successfully',
      data: loan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating loan'
    });
  }
};

// Delete loan — only while nothing has been recovered against it. Reverses
// the disbursement voucher's ledger balances and removes both the voucher
// and the loan record, so no orphaned accounting entries are left behind.
export const deleteLoan = async (req, res) => {
  try {
    const loan = await ProducerLoan.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    const hasPaidEMI = loan.emiSchedule.some(emi => emi.paidAmount > 0);
    if (hasPaidEMI) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a loan with recorded EMI payments — cancel it instead'
      });
    }

    if (loan.voucherId) {
      const voucher = await Voucher.findById(loan.voucherId);
      if (voucher) {
        if (voucher.status !== 'Cancelled') {
          const reversedEntries = voucher.entries.map(e => ({
            ledgerId: e.ledgerId,
            ledgerName: e.ledgerName,
            debitAmount: e.creditAmount,
            creditAmount: e.debitAmount,
          }));
          await updateLedgerBalances(reversedEntries, null, req.companyId);
        }
        await Voucher.deleteOne({ _id: voucher._id });
      }
    }

    await ProducerLoan.deleteOne({ _id: loan._id });

    res.status(200).json({
      success: true,
      message: 'Loan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting loan'
    });
  }
};

// Cancel loan
export const cancelLoan = async (req, res) => {
  try {
    const { reason } = req.body;
    const loan = await ProducerLoan.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    if (loan.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Loan is already cancelled'
      });
    }

    // Check if any EMI has been paid
    const hasPaidEMI = loan.emiSchedule.some(emi => emi.paidAmount > 0);

    if (hasPaidEMI) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel loan with paid EMIs'
      });
    }

    loan.status = 'Cancelled';
    loan.cancelledAt = new Date();
    loan.cancelledBy = req.user?._id;
    loan.cancellationReason = reason;

    await loan.save();

    // Reverse voucher if exists
    if (loan.voucherId) {
      const voucher = await Voucher.findById(loan.voucherId);
      if (voucher) {
        // Reverse ledger balances
        const reversedEntries = voucher.entries.map(e => ({
          ledgerId: e.ledgerId,
          ledgerName: e.ledgerName,
          debitAmount: e.creditAmount,
          creditAmount: e.debitAmount
        }));
        await updateLedgerBalances(reversedEntries);

        // Mark voucher as cancelled
        voucher.status = 'Cancelled';
        await voucher.save();
      }
    }
    res.status(200).json({
      success: true,
      message: 'Loan cancelled successfully',
      data: loan
    });
  } catch (error) {
    console.error('Error cancelling loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling loan'
    });
  } finally {
  }
};

// Record EMI payment
export const recordEMIPayment = async (req, res) => {
  try {
    const { emiNumber, amount, paymentId, remarks } = req.body;
    const loan = await ProducerLoan.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!loan) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found'
      });
    }

    if (loan.status === 'Closed' || loan.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment for closed or cancelled loan'
      });
    }

    const emi = loan.emiSchedule.find(e => e.emiNumber === emiNumber);

    if (!emi) {
      return res.status(404).json({
        success: false,
        message: 'EMI not found'
      });
    }

    const remainingAmount = emi.amount - emi.paidAmount;
    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${amount}) exceeds remaining EMI amount (${remainingAmount})`
      });
    }

    // Record the payment
    emi.paidAmount += amount;
    emi.paidDate = new Date();
    if (paymentId) emi.paymentId = paymentId;
    if (remarks) emi.remarks = remarks;

    if (emi.paidAmount >= emi.amount) {
      emi.status = 'Paid';
    } else {
      emi.status = 'Partial';
    }

    // Update loan totals
    loan.recoveredAmount += amount;
    loan.outstandingAmount = loan.totalLoanAmount - loan.recoveredAmount;

    // Check if loan is fully paid
    if (loan.outstandingAmount <= 0) {
      loan.status = 'Closed';
      loan.closedAt = new Date();
      loan.closedBy = req.user?._id;
    }

    await loan.save();
    res.status(200).json({
      success: true,
      message: 'EMI payment recorded successfully',
      data: loan
    });
  } catch (error) {
    console.error('Error recording EMI payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error recording EMI payment'
    });
  } finally {
  }
};

// Get loan statistics
export const getLoanStats = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const query = {};
    if (req.userCompany) query.companyId = new mongoose.Types.ObjectId(req.userCompany);

    if (fromDate || toDate) {
      query.loanDate = {};
      if (fromDate) query.loanDate.$gte = new Date(fromDate);
      if (toDate) query.loanDate.$lte = new Date(toDate);
    }

    // Status-wise stats
    const statusStats = await ProducerLoan.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDisbursed: { $sum: '$disbursedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' },
          totalRecovered: { $sum: '$recoveredAmount' }
        }
      }
    ]);

    // Type-wise stats
    const typeStats = await ProducerLoan.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: '$loanType',
          count: { $sum: 1 },
          totalDisbursed: { $sum: '$disbursedAmount' },
          totalOutstanding: { $sum: '$outstandingAmount' }
        }
      }
    ]);

    // Monthly disbursement trend
    const monthlyTrend = await ProducerLoan.aggregate([
      { $match: { ...query, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: {
            year: { $year: '$loanDate' },
            month: { $month: '$loanDate' }
          },
          count: { $sum: 1 },
          totalDisbursed: { $sum: '$disbursedAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusWise: statusStats,
        typeWise: typeStats,
        monthlyTrend
      }
    });
  } catch (error) {
    console.error('Error fetching loan stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching loan statistics'
    });
  }
};

// Get loan types from EarningDeduction LOAN_RECOVERY category
export const getLoanTypes = async (req, res) => {
  try {
    const items = await EarningDeduction.find({
      companyId: req.userCompany,
      category: 'LOAN_RECOVERY',
      active: true,
    }).sort({ name: 1 }).select('name shortName');

    res.status(200).json({
      success: true,
      data: items.map(i => ({ value: i.name, label: i.name, shortName: i.shortName })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createLoan,
  getAllLoans,
  getLoanById,
  getFarmerLoans,
  updateLoan,
  deleteLoan,
  cancelLoan,
  recordEMIPayment,
  getLoanStats,
  getLoanTypes,
};
