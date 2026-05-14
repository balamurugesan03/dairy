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
  try {
    const receiptData = req.body;
    receiptData.companyId = req.userCompany;
    receiptData.createdBy = req.user?._id;

    const receipt = new ProducerReceipt(receiptData);
    await receipt.save();

    // Create receipt voucher (handles Cash Book + Day Book posting)
    try {
      const voucher = await createReceiptVoucher(receipt, receiptData.receiptType, req.userCompany, receiptData.bankLedgerId);
      if (voucher) {
        receipt.voucherId = voucher._id;
        await receipt.save();
      }
    } catch (voucherError) {
      console.error('Voucher creation failed:', voucherError);
    }

    // Update Advance / ProducerLoan module records
    try {
      await applyReceiptToRecords(receipt, req.userCompany);
      await receipt.save();
    } catch (applyError) {
      console.error('Advance/Loan record update failed:', applyError);
    }

    await receipt.populate('farmerId', 'farmerNumber personalDetails');

    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: receipt
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating receipt'
    });
  }
};

// Apply a receipt's amount to the farmer's Advance / ProducerLoan records (FIFO)
const applyReceiptToRecords = async (receipt, companyId) => {
  const { receiptType, farmerId, amount, receiptDate, _id: receiptId, receiptNumber } = receipt;
  let remaining = amount;

  if (receiptType === 'CF Advance' || receiptType === 'Cash Advance') {
    const advances = await Advance.find({
      companyId,
      farmerId,
      advanceCategory: receiptType,
      status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] },
      balanceAmount: { $gt: 0 },
    }).sort({ advanceDate: 1 });

    for (const adv of advances) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, adv.balanceAmount);
      adv.adjustedAmount += deduct;
      adv.balanceAmount  -= deduct;
      adv.adjustments.push({
        date:          receiptDate || new Date(),
        amount:        deduct,
        referenceType: 'Manual',
        referenceId:   receiptId,
        paymentNumber: receiptNumber,
        remarks:       `Receipt ${receiptNumber}`,
      });
      await adv.save();
      remaining -= deduct;

      if (!receipt.referenceId) {
        receipt.referenceId    = adv._id;
        receipt.referenceType  = 'Advance';
        receipt.referenceModel = 'Advance';
        receipt.referenceNumber = adv.advanceNumber;
      }
    }

  } else if (receiptType === 'Loan Advance') {
    const loans = await ProducerLoan.find({
      companyId,
      farmerId,
      status: { $in: ['Active', 'Defaulted'] },
      outstandingAmount: { $gt: 0 },
    }).sort({ loanDate: 1 });

    for (const loan of loans) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, loan.outstandingAmount);
      loan.recoveredAmount   += deduct;
      loan.outstandingAmount -= deduct;

      // Apply to EMI schedule oldest-pending first
      let toApply = deduct;
      for (const emi of loan.emiSchedule) {
        if (toApply <= 0) break;
        if (emi.status === 'Paid') continue;
        const pending = emi.amount - (emi.paidAmount || 0);
        if (pending <= 0) continue;
        const apply    = Math.min(toApply, pending);
        emi.paidAmount = (emi.paidAmount || 0) + apply;
        toApply       -= apply;
        if (emi.paidAmount >= emi.amount) {
          emi.status   = 'Paid';
          emi.paidDate = receiptDate || new Date();
        } else {
          emi.status = 'Partial';
        }
      }

      if (loan.outstandingAmount <= 0) {
        loan.status   = 'Closed';
        loan.closedAt = new Date();
      }
      await loan.save();
      remaining -= deduct;

      if (!receipt.referenceId) {
        receipt.referenceId    = loan._id;
        receipt.referenceType  = 'Loan';
        receipt.referenceModel = 'ProducerLoan';
        receipt.referenceNumber = loan.loanNumber;
      }
    }
  }
};

// Regex map to find the correct advance ledger from Ledger management
const ADVANCE_LEDGER_REGEX = {
  'CF Advance':   /^cattle\s*feed\s*advance$/i,
  'Cash Advance': /^farmers?\s*cash\s*advance$/i,
  'Loan Advance': /^farmers?\s*loan/i,
};

// Create receipt voucher
// Cash:     Dr Cash,        Cr Advance Ledger  → voucherType 'Receipt' (cash column in Day Book + Cash Book)
// Bank/UPI: Dr Bank Ledger, Cr Advance Ledger  → voucherType 'Journal' (adjustment column in Day Book via direct query)
const createReceiptVoucher = async (receipt, receiptType, companyId, bankLedgerId) => {
  const entries = [];
  const isCash  = receipt.paymentMode === 'Cash';

  // ── Resolve advance ledger ──
  const regex = ADVANCE_LEDGER_REGEX[receiptType];
  let advanceLedger = regex
    ? await Ledger.findOne({ companyId, ledgerName: { $regex: regex } })
    : null;

  if (!advanceLedger) {
    // Fallback names
    const fallbackNames = {
      'CF Advance':   'CATTLE FEED ADVANCE',
      'Cash Advance': 'Farmers Cash Advance',
      'Loan Advance': 'Farmers Loan A/C',
    };
    const fallbackName = fallbackNames[receiptType] || receiptType;
    advanceLedger = await Ledger.findOne({ companyId, ledgerName: fallbackName });
    if (!advanceLedger) {
      advanceLedger = new Ledger({
        ledgerName: fallbackName,
        ledgerType: 'Other Receivable',
        companyId,
        openingBalance: 0,
        currentBalance: 0,
        balanceType: 'Dr'
      });
      await advanceLedger.save();
    }
  }

  // ── Resolve payment ledger (Cash or Bank) ──
  let paymentLedger;
  if (isCash) {
    paymentLedger = await Ledger.findOne({ companyId, ledgerType: 'Cash' });
  } else if (bankLedgerId) {
    paymentLedger = await Ledger.findById(bankLedgerId);
  }

  // Store bank ledger name on receipt for Day Book direct query
  if (!isCash && paymentLedger) {
    await ProducerReceipt.findByIdAndUpdate(receipt._id, { bankLedgerName: paymentLedger.ledgerName });
  }

  if (paymentLedger) {
    entries.push({
      ledgerId: paymentLedger._id,
      ledgerName: paymentLedger.ledgerName,
      debitAmount: receipt.amount,
      creditAmount: 0
    });
  }

  entries.push({
    ledgerId: advanceLedger._id,
    ledgerName: advanceLedger.ledgerName,
    debitAmount: 0,
    creditAmount: receipt.amount
  });

  const totalDebit  = entries.reduce((sum, e) => sum + e.debitAmount,  0);
  const totalCredit = entries.reduce((sum, e) => sum + e.creditAmount, 0);

  const farmerName = receipt.farmerId?.personalDetails?.name || '';
  const voucherNumber = await generateVoucherNumber('Receipt', companyId);

  const voucher = new Voucher({
    voucherType: isCash ? 'Receipt' : 'Journal',
    voucherNumber,
    voucherDate: receipt.receiptDate,
    companyId,
    entries,
    totalDebit,
    totalCredit,
    narration: `${receiptType} Return — ${farmerName} (${receipt.receiptNumber})`,
    referenceType: 'ProducerReceipt',
    referenceId: receipt._id
  });

  await voucher.save();
  await updateLedgerBalances(entries);

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
    const receipt = await ProducerReceipt.findOne({ _id: req.params.id, companyId: req.companyId })
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
  try {
    const { reason } = req.body;
    const receipt = await ProducerReceipt.findOne({ _id: req.params.id, companyId: req.companyId });

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

    // Reverse the balance update on the reference (only if one was linked)
    if (receipt.referenceId && receipt.referenceType === 'Loan') {
      const loan = await ProducerLoan.findById(receipt.referenceId);
      if (loan) {
        loan.recoveredAmount -= receipt.amount;
        loan.outstandingAmount += receipt.amount;
        // Revert EMI statuses (reverse from last paid EMI)
        let toReverse = receipt.amount;
        for (let i = loan.emiSchedule.length - 1; i >= 0 && toReverse > 0; i--) {
          const emi = loan.emiSchedule[i];
          if (emi.paidAmount <= 0) continue;
          const revert = Math.min(emi.paidAmount, toReverse);
          emi.paidAmount -= revert;
          toReverse -= revert;
          if (emi.paidAmount <= 0) {
            emi.status = 'Pending';
            emi.paidDate = null;
          } else {
            emi.status = 'Partial';
          }
        }
        if (loan.status === 'Closed') {
          loan.status = 'Active';
          loan.closedAt = null;
        }
        await loan.save();
      }
    } else if (receipt.referenceId) {
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
        await advance.save();
      }
    }

    receipt.status = 'Cancelled';
    receipt.cancelledAt = new Date();
    receipt.cancelledBy = req.user?._id;
    receipt.cancellationReason = reason;
    await receipt.save();

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
        await updateLedgerBalances(reversedEntries);
        voucher.status = 'Cancelled';
        await voucher.save();
      }
    }
    res.status(200).json({
      success: true,
      message: 'Receipt cancelled successfully',
      data: receipt
    });
  } catch (error) {
    console.error('Error cancelling receipt:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error cancelling receipt'
    });
  } finally {
  }
};

// Get receipt print data
export const getReceiptPrintData = async (req, res) => {
  try {
    const receipt = await ProducerReceipt.findOne({ _id: req.params.id, companyId: req.companyId })
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
