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

    // ── def_voucher_type enforcement (Receipt Voucher only) ─────────────────
    // Account Group rule: a ledger whose def_voucher_type = 'P' (Payment Side
    // Only) may never be the head-of-account (credited) side of a Receipt
    // Voucher — only 'R' (Receipt Side Only) and 'B' (Both) ledgers qualify.
    // This is checked on the CREDIT leg only: that's the ledger the user
    // actually picks as "head of account" in the Receipt Voucher screen; the
    // Cash/Bank debit leg is the automatic counter-entry and is exempt.
    // Without this check a P-only ledger could be credited via Receipt
    // Voucher, which silently disappears from the R/P-driven reports
    // (Receipts & Payments Statement, R&D Statement, Ledger Abstract —
    // Grouped) because those only surface a 'P' ledger's DEBIT activity.
    if (voucherData.voucherType === 'Receipt') {
      const creditLegLedgerIds = voucherData.entries
        .filter(e => (e.creditAmount || 0) > 0)
        .map(e => e.ledgerId);

      if (creditLegLedgerIds.length) {
        const creditedLedgers = await Ledger.find({
          _id: { $in: creditLegLedgerIds },
          companyId: req.companyId
        }).select('ledgerName voucherType');

        const paymentOnlyLedger = creditedLedgers.find(l => l.voucherType === 'P');
        if (paymentOnlyLedger) {
          return res.status(400).json({
            success: false,
            message: `"${paymentOnlyLedger.ledgerName}" is a Payment-side ledger (def_voucher_type = P) and cannot be used as the head of account in a Receipt Voucher.`
          });
        }
      }
    }

    // ── def_voucher_type enforcement (Payment Voucher — mirror of Receipt) ──
    // A ledger whose def_voucher_type = 'R' (Receipt Side Only) may never be
    // the head-of-account (debited) side of a Payment Voucher — only 'P'
    // (Payment Side Only) and 'B' (Both) ledgers qualify. Checked on the
    // DEBIT leg only (the ledger the user picks as "head of account" in the
    // Payment Voucher screen); the Cash/Bank credit leg is the automatic
    // counter-entry and is exempt.
    if (voucherData.voucherType === 'Payment') {
      const debitLegLedgerIds = voucherData.entries
        .filter(e => (e.debitAmount || 0) > 0)
        .map(e => e.ledgerId);

      if (debitLegLedgerIds.length) {
        const debitedLedgers = await Ledger.find({
          _id: { $in: debitLegLedgerIds },
          companyId: req.companyId
        }).select('ledgerName voucherType');

        const receiptOnlyLedger = debitedLedgers.find(l => l.voucherType === 'R');
        if (receiptOnlyLedger) {
          return res.status(400).json({
            success: false,
            message: `"${receiptOnlyLedger.ledgerName}" is a Receipt-side ledger (def_voucher_type = R) and cannot be used as the head of account in a Payment Voucher.`
          });
        }
      }
    }

    // ── Journal Voucher: no Cash/Bank leg allowed ────────────────────────────
    // def_voucher_type (R/P/B) governs which ledger may sit opposite a
    // Cash/Bank movement in a Receipt or Payment Voucher. Journal Voucher is
    // the general-purpose "any two ledgers" adjustment instrument (accruals,
    // provisions, write-offs, inter-ledger transfers) and is intentionally
    // NOT restricted by R/P/B — every automatic Journal posting in this
    // system (advance recovery, credit-mode milk sales, purchase/sales
    // returns, union sales) adjusts two non-cash ledgers and never touches
    // Cash/Bank. If a user were allowed to include a Cash/Bank ledger in a
    // manual Journal Voucher, they could pair it with a Payment-only or
    // Receipt-only ledger and bypass the checks above entirely — so instead
    // of restricting *which* ledger a Journal touches, we simply forbid it
    // from ever touching Cash/Bank, which is what actually makes it a
    // "Journal" instead of a Receipt/Payment/Contra in the first place.
    if (voucherData.voucherType === 'Journal') {
      const CASH_BANK_TYPES = ['Cash', 'Bank', 'Cash in Hand', 'Bank Accounts'];
      const journalLedgerIds = voucherData.entries.map(e => e.ledgerId);
      const journalLedgers = await Ledger.find({
        _id: { $in: journalLedgerIds },
        companyId: req.companyId
      }).select('ledgerName ledgerType');

      const cashOrBankLedger = journalLedgers.find(l => CASH_BANK_TYPES.includes(l.ledgerType));
      if (cashOrBankLedger) {
        return res.status(400).json({
          success: false,
          message: `"${cashOrBankLedger.ledgerName}" is a Cash/Bank ledger and cannot be used in a Journal Voucher — use Receipt, Payment, or Contra instead.`
        });
      }
    }

    voucherData.totalDebit = totalDebit;
    voucherData.totalCredit = totalCredit;

    // Generate voucher number
    voucherData.voucherNumber = await generateVoucherNumber(voucherData.voucherType, req.companyId);
    voucherData.companyId = req.companyId;

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

    const query = { companyId: req.companyId };

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
    const voucher = await Voucher.findOne({ _id: req.params.id, companyId: req.companyId })
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

// Delete voucher — reverses ledger balances then removes the document
export const deleteVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found'
      });
    }

    // Reverse ledger balances: swap debit ↔ credit for each entry
    const reversedEntries = voucher.entries.map(e => ({
      ledgerId: e.ledgerId,
      debitAmount:  e.creditAmount || 0,
      creditAmount: e.debitAmount  || 0
    }));
    await updateLedgerBalances(reversedEntries, null, req.companyId);

    await voucher.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Voucher deleted and ledger balances reversed'
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

    const companyId = req.companyId;

    // Check for duplicate ledger name per company
    const existingLedger = await Ledger.findOne({ ledgerName: ledgerData.ledgerName, companyId });
    if (existingLedger) {
      return res.status(400).json({
        success: false,
        message: 'Ledger with this name already exists'
      });
    }

    // Set initial current balance same as opening balance
    ledgerData.currentBalance = ledgerData.openingBalance || 0;
    ledgerData.balanceType = ledgerData.openingBalanceType || 'Dr';
    ledgerData.companyId = companyId;

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

    const query = { companyId: req.companyId };

    // Exclude auto-linked party ledgers (Farmers, Agents) from general ledger list
    query['linkedEntity.entityType'] = { $nin: ['Farmer', 'Agent'] };

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

    const ledger = await Ledger.findOne({ _id: req.params.id, companyId: req.companyId });

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
      companyId: req.companyId,
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
