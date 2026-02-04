import ProducerReceipt from '../models/ProducerReceipt.js';
import ProducerLoan from '../models/ProducerLoan.js';
import Advance from '../models/Advance.js';
import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import Farmer from '../models/Farmer.js';
import mongoose from 'mongoose';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

// Create a new producer receipt
export const createReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const receiptData = req.body;
    receiptData.companyId = req.userCompany;
    receiptData.createdBy = req.user?._id;

    // Get the reference (Advance or Loan)
    let reference;
    let previousBalance = 0;

    if (receiptData.referenceType === 'Loan') {
      reference = await ProducerLoan.findById(receiptData.referenceId);
      if (!reference) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Loan not found'
        });
      }
      previousBalance = reference.outstandingAmount;
      receiptData.referenceNumber = reference.loanNumber;
    } else {
      reference = await Advance.findById(receiptData.referenceId);
      if (!reference) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: 'Advance not found'
        });
      }
      previousBalance = reference.balanceAmount;
      receiptData.referenceNumber = reference.advanceNumber;
    }

    // Validate amount doesn't exceed balance
    if (receiptData.amount > previousBalance) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Receipt amount (${receiptData.amount}) exceeds outstanding balance (${previousBalance})`
      });
    }

    // Set balance tracking
    receiptData.previousBalance = previousBalance;
    receiptData.newBalance = previousBalance - receiptData.amount;

    const receipt = new ProducerReceipt(receiptData);
    await receipt.save({ session });

    // Update the reference balance
    if (receiptData.referenceType === 'Loan') {
      reference.recoveredAmount += receiptData.amount;
      reference.outstandingAmount -= receiptData.amount;

      if (reference.outstandingAmount <= 0) {
        reference.status = 'Closed';
        reference.closedAt = new Date();
      }

      await reference.save({ session });
    } else {
      // Advance
      reference.adjustedAmount += receiptData.amount;
      reference.balanceAmount -= receiptData.amount;

      // Add adjustment record
      reference.adjustments.push({
        date: new Date(),
        amount: receiptData.amount,
        referenceType: 'Payment',
        referenceId: receipt._id,
        remarks: `Receipt: ${receipt.receiptNumber}`,
        adjustedBy: req.user?._id
      });

      if (reference.balanceAmount <= 0) {
        reference.status = 'Adjusted';
      } else {
        reference.status = 'Partially Adjusted';
      }

      await reference.save({ session });
    }

    // Create receipt voucher
    try {
      const voucher = await createReceiptVoucher(receipt, receiptData.receiptType, session, req.userCompany);
      if (voucher) {
        receipt.voucherId = voucher._id;
        await receipt.save({ session });
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
    }

    await session.commitTransaction();

    // Populate farmer details
    await receipt.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: receipt
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating receipt'
    });
  } finally {
    session.endSession();
  }
};

// Create receipt voucher
const createReceiptVoucher = async (receipt, receiptType, session, companyId) => {
  const entries = [];

  // Get ledger name based on receipt type
  const advanceLedgerName = receiptType;

  // Entry 1: Debit Cash/Bank
  const paymentLedgerName = receipt.paymentMode === 'Cash' ? 'Cash' : 'Bank';
  const paymentLedger = await Ledger.findOne({
    ledgerName: paymentLedgerName,
    ledgerType: receipt.paymentMode === 'Cash' ? 'Cash' : 'Bank',
    companyId
  });

  if (paymentLedger) {
    entries.push({
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: receipt.amount,
      creditAmount: 0
    });
  }

  // Entry 2: Credit Advance/Loan Ledger
  let advanceLedger = await Ledger.findOne({
    ledgerName: advanceLedgerName,
    companyId
  });

  if (!advanceLedger) {
    advanceLedger = new Ledger({
      ledgerName: advanceLedgerName,
      ledgerType: 'Other Receivable',
      companyId,
      openingBalance: 0,
      currentBalance: 0,
      balanceType: 'Dr'
    });
    await advanceLedger.save({ session });
  }

  entries.push({
    ledgerId: advanceLedger._id,
    ledgerName: advanceLedger.ledgerName,
    debitAmount: 0,
    creditAmount: receipt.amount
  });

  const totalDebit = entries.reduce((sum, e) => sum + e.debitAmount, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const voucherNumber = await generateVoucherNumber('Receipt');

  const voucher = new Voucher({
    voucherType: 'Receipt',
    voucherNumber,
    voucherDate: receipt.receiptDate,
    companyId,
    entries,
    totalDebit,
    totalCredit,
    narration: `${receiptType} receipt - ${receipt.receiptNumber}`,
    referenceType: 'Receipt',
    referenceId: receipt._id
  });

  await voucher.save({ session });
  await updateLedgerBalances(entries, session);

  return voucher;
};

// Get all receipts
export const getAllReceipts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      farmerId = '',
      receiptType = '',
      fromDate = '',
      toDate = '',
      sortBy = 'receiptDate',
      sortOrder = 'desc'
    } = req.query;

    const query = { status: 'Active' };
    if (req.userCompany) query.companyId = new mongoose.Types.ObjectId(req.userCompany);
    if (farmerId) query.farmerId = new mongoose.Types.ObjectId(farmerId);
    if (receiptType) query.receiptType = receiptType;

    if (fromDate || toDate) {
      query.receiptDate = {};
      if (fromDate) query.receiptDate.$gte = new Date(fromDate);
      if (toDate) query.receiptDate.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const receipts = await ProducerReceipt.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('farmerId', 'farmerNumber personalDetails')
      .populate('createdBy', 'name');

    const total = await ProducerReceipt.countDocuments(query);

    // Calculate summary - build aggregation query with ObjectId
    const aggregateQuery = { status: 'Active' };
    if (req.userCompany) aggregateQuery.companyId = new mongoose.Types.ObjectId(req.userCompany);

    const summary = await ProducerReceipt.aggregate([
      { $match: aggregateQuery },
      {
        $group: {
          _id: '$receiptType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: receipts,
      summary,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching receipts'
    });
  }
};

// Get single receipt by ID
export const getReceiptById = async (req, res) => {
  try {
    const receipt = await ProducerReceipt.findById(req.params.id)
      .populate('farmerId', 'farmerNumber personalDetails bankDetails address')
      .populate('createdBy', 'name')
      .populate('cancelledBy', 'name');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching receipt'
    });
  }
};

// Get farmer's receipts
export const getFarmerReceipts = async (req, res) => {
  try {
    const { fromDate, toDate, receiptType, limit = 50 } = req.query;

    const query = { farmerId: req.params.farmerId, status: 'Active' };

    if (receiptType) query.receiptType = receiptType;

    if (fromDate || toDate) {
      query.receiptDate = {};
      if (fromDate) query.receiptDate.$gte = new Date(fromDate);
      if (toDate) query.receiptDate.$lte = new Date(toDate);
    }

    const receipts = await ProducerReceipt.find(query)
      .sort({ receiptDate: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'name');

    // Get summary by type
    const summary = await ProducerReceipt.getFarmerReceiptSummary(
      req.params.farmerId,
      fromDate,
      toDate
    );

    res.status(200).json({
      success: true,
      data: receipts,
      summary
    });
  } catch (error) {
    console.error('Error fetching farmer receipts:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching farmer receipts'
    });
  }
};

// Cancel receipt
export const cancelReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    const receipt = await ProducerReceipt.findById(req.params.id);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    if (receipt.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Receipt is already cancelled'
      });
    }

    // Reverse the balance update on the reference
    if (receipt.referenceType === 'Loan') {
      const loan = await ProducerLoan.findById(receipt.referenceId);
      if (loan) {
        loan.recoveredAmount -= receipt.amount;
        loan.outstandingAmount += receipt.amount;
        if (loan.status === 'Closed') {
          loan.status = 'Active';
          loan.closedAt = null;
        }
        await loan.save({ session });
      }
    } else {
      const advance = await Advance.findById(receipt.referenceId);
      if (advance) {
        advance.adjustedAmount -= receipt.amount;
        advance.balanceAmount += receipt.amount;
        if (advance.status === 'Adjusted') {
          advance.status = 'Partially Adjusted';
        }
        // Remove the adjustment record
        advance.adjustments = advance.adjustments.filter(
          adj => adj.referenceId?.toString() !== receipt._id.toString()
        );
        await advance.save({ session });
      }
    }

    receipt.status = 'Cancelled';
    receipt.cancelledAt = new Date();
    receipt.cancelledBy = req.user?._id;
    receipt.cancellationReason = reason;
    await receipt.save({ session });

    // Reverse voucher if exists
    if (receipt.voucherId) {
      const voucher = await Voucher.findById(receipt.voucherId);
      if (voucher) {
        const reversedEntries = voucher.entries.map(e => ({
          ledgerId: e.ledgerId,
          ledgerName: e.ledgerName,
          debitAmount: e.creditAmount,
          creditAmount: e.debitAmount
        }));
        await updateLedgerBalances(reversedEntries, session);
        voucher.status = 'Cancelled';
        await voucher.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Receipt cancelled successfully',
      data: receipt
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error cancelling receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling receipt'
    });
  } finally {
    session.endSession();
  }
};

// Get receipt print data
export const getReceiptPrintData = async (req, res) => {
  try {
    const receipt = await ProducerReceipt.findById(req.params.id)
      .populate('farmerId', 'farmerNumber personalDetails address')
      .populate('createdBy', 'name');

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    // Update print count
    receipt.printCount += 1;
    receipt.lastPrintedAt = new Date();
    await receipt.save();

    // Format print data
    const printData = {
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.receiptDate,
      farmer: {
        number: receipt.farmerId?.farmerNumber,
        name: receipt.farmerId?.personalDetails?.name,
        village: receipt.farmerId?.address?.village,
        phone: receipt.farmerId?.personalDetails?.phone
      },
      receiptType: receipt.receiptType,
      referenceNumber: receipt.referenceNumber,
      paymentMode: receipt.paymentMode,
      amount: receipt.amount,
      previousBalance: receipt.previousBalance,
      newBalance: receipt.newBalance,
      remarks: receipt.remarks,
      createdBy: receipt.createdBy?.name,
      printCount: receipt.printCount
    };

    res.status(200).json({
      success: true,
      data: printData
    });
  } catch (error) {
    console.error('Error getting print data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error getting print data'
    });
  }
};

export default {
  createReceipt,
  getAllReceipts,
  getReceiptById,
  getFarmerReceipts,
  cancelReceipt,
  getReceiptPrintData
};
