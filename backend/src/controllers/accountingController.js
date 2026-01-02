import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';
import mongoose from 'mongoose';

// Create manual voucher
export const createVoucher = async (req, res) => {
  try {
    const voucherData = req.body;

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;

    voucherData.entries.forEach(entry => {
      totalDebit += entry.debitAmount || 0;
      totalCredit += entry.creditAmount || 0;
    });

    // Validate double-entry
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Total Debit must equal Total Credit'
      });
    }

    voucherData.totalDebit = totalDebit;
    voucherData.totalCredit = totalCredit;

    // Generate voucher number
    voucherData.voucherNumber = await generateVoucherNumber(voucherData.voucherType);

    // Create voucher
    const voucher = new Voucher(voucherData);
    await voucher.save();

    // Update ledger balances
    await updateLedgerBalances(voucherData.entries);

    res.status(201).json({
      success: true,
      message: 'Voucher created successfully',
      data: voucher
    });
  } catch (error) {
    console.error('Error creating voucher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating voucher'
    });
  }
};

// Get all vouchers
export const getAllVouchers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      voucherType = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const query = {};

    if (voucherType) {
      query.voucherType = voucherType;
    }

    if (startDate || endDate) {
      query.voucherDate = {};
      if (startDate) query.voucherDate.$gte = new Date(startDate);
      if (endDate) query.voucherDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const vouchers = await Voucher.find(query)
      .sort({ voucherDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('entries.ledgerId', 'ledgerName ledgerType');

    const total = await Voucher.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vouchers,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching vouchers'
    });
  }
};

// Get voucher by ID
export const getVoucherById = async (req, res) => {
  try {
    const voucher = await Voucher.findById(req.params.id)
      .populate('entries.ledgerId');

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      data: voucher
    });
  } catch (error) {
    console.error('Error fetching voucher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching voucher'
    });
  }
};

// Delete voucher
export const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findByIdAndDelete(req.params.id);

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Voucher deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting voucher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting voucher'
    });
  }
};

// Create ledger
export const createLedger = async (req, res) => {
  try {
    const ledgerData = req.body;

    // Check for duplicate ledger name
    const existingLedger = await Ledger.findOne({ ledgerName: ledgerData.ledgerName });
    if (existingLedger) {
      return res.status(400).json({
        success: false,
        message: 'Ledger with this name already exists'
      });
    }

    // Set initial current balance same as opening balance
    ledgerData.currentBalance = ledgerData.openingBalance || 0;
    ledgerData.balanceType = ledgerData.openingBalanceType || 'Dr';

    const ledger = new Ledger(ledgerData);
    await ledger.save();

    res.status(201).json({
      success: true,
      message: 'Ledger created successfully',
      data: ledger
    });
  } catch (error) {
    console.error('Error creating ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating ledger'
    });
  }
};

// Get all ledgers
export const getAllLedgers = async (req, res) => {
  try {
    const { ledgerType = '', status = 'Active', search = '' } = req.query;

    const query = {};

    if (ledgerType) {
      query.ledgerType = ledgerType;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.ledgerName = { $regex: search, $options: 'i' };
    }

    const ledgers = await Ledger.find(query).sort({ ledgerName: 1 });

    res.status(200).json({
      success: true,
      data: ledgers
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledgers'
    });
  }
};

// Get ledger by ID with transactions
export const getLedgerById = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const ledger = await Ledger.findById(req.params.id);

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Get voucher entries for this ledger
    const query = { 'entries.ledgerId': ledger._id };

    if (startDate || endDate) {
      query.voucherDate = {};
      if (startDate) query.voucherDate.$gte = new Date(startDate);
      if (endDate) query.voucherDate.$lte = new Date(endDate);
    }

    const vouchers = await Voucher.find(query).sort({ voucherDate: 1 });

    // Build transaction history
    const transactions = [];
    let runningBalance = ledger.openingBalance;

    vouchers.forEach(voucher => {
      voucher.entries.forEach(entry => {
        if (entry.ledgerId.toString() === ledger._id.toString()) {
          const netChange = entry.debitAmount - entry.creditAmount;
          runningBalance += netChange;

          transactions.push({
            date: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber,
            voucherType: voucher.voucherType,
            debit: entry.debitAmount,
            credit: entry.creditAmount,
            balance: runningBalance,
            narration: entry.narration || voucher.narration
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        ledger,
        transactions
      }
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching ledger'
    });
  }
};

// Update ledger
export const updateLedger = async (req, res) => {
  try {
    const ledger = await Ledger.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ledger updated successfully',
      data: ledger
    });
  } catch (error) {
    console.error('Error updating ledger:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating ledger'
    });
  }
};

// Get outstanding report (party ledgers with balances)
export const getOutstandingReport = async (req, res) => {
  try {
    const ledgers = await Ledger.find({
      ledgerType: { $in: ['Party', 'Accounts Due To (Sundry Creditors)'] },
      status: 'Active',
      currentBalance: { $ne: 0 }
    }).sort({ ledgerName: 1 });

    const report = ledgers.map(ledger => ({
      ledgerName: ledger.ledgerName,
      balance: Math.abs(ledger.currentBalance),
      balanceType: ledger.balanceType,
      entityType: ledger.linkedEntity?.entityType || 'None'
    }));

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching outstanding report:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching outstanding report'
    });
  }
};

export default {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  deleteVoucher,
  createLedger,
  getAllLedgers,
  getLedgerById,
  updateLedger,
  getOutstandingReport
};
