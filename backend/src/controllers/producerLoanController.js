import ProducerLoan from '../models/ProducerLoan.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import mongoose from 'mongoose';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// Create a new producer loan
export const createLoan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
    await loan.save({ session });

    // Create disbursement voucher
    try {
      const voucher = await createLoanDisbursementVoucher(loan, session, req.userCompany);
      if (voucher) {
        loan.voucherId = voucher._id;
        await loan.save({ session });
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
      // Continue without voucher - don't fail the loan creation
    }

    await session.commitTransaction();

    // Populate farmer details for response
    await loan.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Loan created successfully',
      data: loan
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating loan'
    });
  } finally {
    session.endSession();
  }
};

// Create loan disbursement voucher
const createLoanDisbursementVoucher = async (loan, session, companyId) => {
  const entries = [];

  // Get loan type ledger name
  const loanLedgerName = loan.loanType === 'CF Advance' ? 'CF Advance' :
                         loan.loanType === 'Loan Advance' ? 'Loan Advance' :
                         'Cash Advance';

  // Entry 1: Debit Loan/Advance Ledger
  let loanLedger = await Ledger.findOne({
    ledgerName: loanLedgerName,
    companyId
  });

  // Create ledger if not exists
  if (!loanLedger) {
    loanLedger = new Ledger({
      ledgerName: loanLedgerName,
      ledgerType: 'Other Receivable',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Dr'
    });
    await loanLedger.save({ session });
  }

  entries.push({
    ledgerId: loanLedger._id,
    ledgerName: loanLedger.ledgerName,
    debitAmount: loan.principalAmount,
    creditAmount: 0
  });

  // Entry 2: Credit Cash/Bank based on payment mode
  const paymentLedgerName = loan.paymentMode === 'Cash' ? 'Cash' : 'Bank';
  const paymentLedger = await Ledger.findOne({
    ledgerName: paymentLedgerName,
    ledgerType: loan.paymentMode === 'Cash' ? 'Cash' : 'Bank',
    companyId
  });

  if (paymentLedger) {
    entries.push({
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: 0,
      creditAmount: loan.principalAmount
    });
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Payment');

  const voucher = new Voucher({
    voucherType: 'Payment',
    voucherNumber,
    voucherDate: loan.loanDate,
    companyId,
    entries,
    totalDebit,
    totalCredit,
    narration: `${loan.loanType} disbursement - ${loan.loanNumber}`,
    referenceType: 'Loan',
    referenceId: loan._id
  });

  await voucher.save({ session });
  await updateLedgerBalances(entries, session);

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
    const loan = await ProducerLoan.findById(req.params.id)
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

// Update loan
export const updateLoan = async (req, res) => {
  try {
    const loan = await ProducerLoan.findById(req.params.id);

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

    const allowedUpdates = ['remarks', 'purpose', 'guarantorName', 'guarantorPhone'];
    const updateData = {};

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updatedLoan = await ProducerLoan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('farmerId', 'farmerNumber personalDetails');

    res.status(200).json({
      success: true,
      message: 'Loan updated successfully',
      data: updatedLoan
    });
  } catch (error) {
    console.error('Error updating loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating loan'
    });
  }
};

// Cancel loan
export const cancelLoan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    const loan = await ProducerLoan.findById(req.params.id);

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

    await loan.save({ session });

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
        await updateLedgerBalances(reversedEntries, session);

        // Mark voucher as cancelled
        voucher.status = 'Cancelled';
        await voucher.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Loan cancelled successfully',
      data: loan
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error cancelling loan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling loan'
    });
  } finally {
    session.endSession();
  }
};

// Record EMI payment
export const recordEMIPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { emiNumber, amount, paymentId, remarks } = req.body;
    const loan = await ProducerLoan.findById(req.params.id);

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

    await loan.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'EMI payment recorded successfully',
      data: loan
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error recording EMI payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error recording EMI payment'
    });
  } finally {
    session.endSession();
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

export default {
  createLoan,
  getAllLoans,
  getLoanById,
  getFarmerLoans,
  updateLoan,
  cancelLoan,
  recordEMIPayment,
  getLoanStats
};
