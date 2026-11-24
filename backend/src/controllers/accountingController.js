import Voucher from '../models/Voucher.js';
import Ledger from '../models/Ledger.js';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';
import mongoose from 'mongoose';
import { getCashAdvanceVoucherRows } from '../utils/cashAdvanceVoucherRows.js';
import { getCashInHandOpening, getPrimaryCashLedger } from '../utils/cashInHandOpening.js';
import { tagVoucher } from '../utils/voucherSource.js';
import { getCashBankLedgerIds } from '../utils/cashAdjustmentClassifier.js';

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

    // Source screen tag — only a manual entry screen may set it, and only for
    // its own voucher type (Adjustment Entry = Journal; the others Receipt/Payment)
    const SOURCE_TYPES = {
      CashBookEntry: ['Receipt', 'Payment'],
      ReceiptVoucher: ['Receipt'],
      PaymentVoucher: ['Payment'],
      AdjustmentEntry: ['Journal'],
    };
    if (voucherData.entrySource) {
      const allowed = SOURCE_TYPES[voucherData.entrySource];
      if (!allowed || !allowed.includes(voucherData.voucherType)
        || (voucherData.referenceType && voucherData.referenceType !== 'Manual')) {
        delete voucherData.entrySource;
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
      endDate = '',
      includeCashAdvance = '',
      // 'cash' → only Cash in Hand transactions (Cash Book Entry);
      // 'adjustment' → only non-cash ones (Adjustment Entry). Decided here
      // from each row's source and mode, so neither screen sees the other's rows.
      book = ''
    } = req.query;

    const query = { companyId: req.companyId };
    const types = String(voucherType || '').split(',').map(t => t.trim()).filter(Boolean);

    if (types.length) {
      query.voucherType = types.length === 1 ? types[0] : { $in: types };
    }

    if (startDate || endDate) {
      query.voucherDate = {};
      if (startDate) query.voucherDate.$gte = new Date(startDate);
      // A plain YYYY-MM-DD end date covers that whole day, not just its midnight
      if (endDate) query.voucherDate.$lte = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
        ? new Date(`${endDate}T23:59:59.999Z`)
        : new Date(endDate);
    }

    const pageNo = Math.max(parseInt(page) || 1, 1);
    const perPage = Math.max(parseInt(limit) || 10, 1);
    const skip = (pageNo - 1) * perPage;
    const bookFilter = ['cash', 'adjustment'].includes(book) ? book : '';
    const withCashAdvance = ['1', 'true'].includes(String(includeCashAdvance));
    const advTypes = types.filter(t => ['Payment', 'Receipt', 'Journal'].includes(t));

    const ids = await getCashBankLedgerIds(req.companyId);
    // Receipt / Payment Voucher and Adjustment Entry screens also list the
    // Cash Advance module's entries (read-only, never stored as Vouchers — Day
    // Book / Cash Book read them from Advance directly).
    const cashAdvanceRows = (opts) => (withCashAdvance && (!types.length || advTypes.length)
      ? getCashAdvanceVoucherRows(req.companyId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        voucherTypes: types.length ? advTypes : undefined,
        ...opts
      })
      : []);

    let data;
    let total;
    if (bookFilter) {
      // Book view: classify every row (stored + Cash Advance) by its mode,
      // keep only this book's rows, then page the result.
      const [stored, extra] = await Promise.all([
        Voucher.find(query).sort({ voucherDate: -1, createdAt: -1 })
          .populate('entries.ledgerId', 'ledgerName ledgerType').lean(),
        cashAdvanceRows()
      ]);
      const rows = [...stored, ...extra]
        .map(v => tagVoucher(v, ids))
        .filter(v => v.book === bookFilter);
      total = rows.length;
      data = rows.slice(skip, skip + perPage);
    } else {
      const vouchers = await Voucher.find(query)
        .sort({ voucherDate: -1 })
        .skip(skip)
        .limit(perPage)
        .populate('entries.ledgerId', 'ledgerName ledgerType')
        .lean();
      total = await Voucher.countDocuments(query);
      const extra = pageNo === 1 ? await cashAdvanceRows() : [];
      data = [...vouchers, ...extra].map(v => tagVoucher(v, ids));
    }

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNo,
        pages: Math.ceil(total / perPage)
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

// Cash Book Entry — one day's cash position from the Voucher collection.
// Every voucher with a Cash leg (Receipt/Payment Voucher screens, plus any
// auto-posted cash voucher) is a row, so Receipt/Payment entries show here
// without being stored twice. Opening = Cash ledger opening balance + all
// cash legs before the date, so each day's opening equals the previous
// day's closing exactly.
// GET /api/vouchers/cash-book-entry?date=YYYY-MM-DD
export const getCashBookEntry = async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '')
      ? req.query.date
      : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    const companyId = new mongoose.Types.ObjectId(String(req.companyId));

    // Opening: the SAME shared calculation Day Book and Cash Book use —
    // Payment Settings → Account Opening Balance (held on the Cash in Hand
    // ledger) + every cash leg before the date.
    const { openingBalance, cashIds } = await getCashInHandOpening(companyId, dayStart);
    const isCash = (id) => cashIds.some(c => c.equals(id?._id || id));
    const notCancelled = { status: { $ne: 'Cancelled' } };

    const vouchers = cashIds.length ? await Voucher.find({
      companyId, ...notCancelled,
      voucherDate: { $gte: dayStart, $lte: dayEnd },
      'entries.ledgerId': { $in: cashIds }
    })
      .sort({ voucherDate: 1, createdAt: 1 })
      .populate('entries.ledgerId', 'ledgerName ledgerType')
      .lean() : [];

    // Cash Advance module entries paid / received in cash (read-only rows;
    // Day Book and Cash Book list the same advances, so the day's closing matches)
    const cashAdvRows = await getCashAdvanceVoucherRows(companyId, {
      startDate: dayStart, endDate: dayEnd, voucherTypes: ['Payment', 'Receipt']
    });

    // Only Cash-mode rows belong here (a Bank-mode Cash Advance is an Adjustment)
    const ids = await getCashBankLedgerIds(companyId);
    const cashBookRows = [...vouchers, ...cashAdvRows]
      .map(v => tagVoucher(v, ids))
      .filter(v => v.book === 'cash');

    const rows = cashBookRows.map(v => {
      let cashIn = 0, cashOut = 0;
      const heads = [];
      (v.entries || []).forEach(e => {
        if (v.isVirtual ? e.isCashLeg : isCash(e.ledgerId)) {
          cashIn += e.debitAmount || 0;
          cashOut += e.creditAmount || 0;
        } else {
          heads.push({
            ledgerId: e.ledgerId?._id || e.ledgerId,
            ledgerName: e.ledgerId?.ledgerName || e.ledgerName,
            amount: (e.debitAmount || 0) + (e.creditAmount || 0),
            narration: e.narration || ''
          });
        }
      });
      return {
        voucher: v,
        side: cashIn >= cashOut ? 'receipt' : 'payment',
        cashIn,
        cashOut,
        heads,
        // Only plain manual Receipt/Payment vouchers are edited here —
        // everything else belongs to the module that posted it
        editable: !v.isVirtual && v.referenceType === 'Manual' && ['Receipt', 'Payment'].includes(v.voucherType)
          && (v.entries || []).length === 2 && heads.length === 1
      };
    });

    const totalReceipts = rows.reduce((s, r) => s + r.cashIn, 0);
    const totalPayments = rows.reduce((s, r) => s + r.cashOut, 0);
    // Same cash ledger every posting and report uses
    const primaryCash = await getPrimaryCashLedger(companyId);

    res.status(200).json({
      success: true,
      data: {
        date,
        cashLedger: primaryCash && { _id: primaryCash._id, ledgerName: primaryCash.ledgerName },
        openingBalance,
        totalReceipts,
        totalPayments,
        closingBalance: openingBalance + totalReceipts - totalPayments,
        rows
      }
    });
  } catch (error) {
    console.error('Error fetching cash book entry:', error);
    res.status(500).json({ success: false, message: error.message || 'Error fetching cash book entry' });
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

// Update voucher — Manual entries only. Receipt Voucher, Payment Voucher and
// Adjustment (Journal) Entry all allow editing their own manually-created
// vouchers; anything with a non-Manual referenceType was generated by another
// module (Cash/Adjustment auto-postings, MilkSale, FarmerPayment, etc.) and
// must be edited from that module instead — this endpoint refuses those.
export const updateVoucher = async (req, res) => {
  try {
    const voucher = await Voucher.findOne({ _id: req.params.id, companyId: req.companyId });

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    if (voucher.referenceType !== 'Manual') {
      return res.status(400).json({
        success: false,
        message: 'This entry was generated automatically by another module — edit it there instead.'
      });
    }

    const { voucherDate, entries, narration, isMilkBill } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one entry is required' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    entries.forEach(e => {
      totalDebit += e.debitAmount || 0;
      totalCredit += e.creditAmount || 0;
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ success: false, message: 'Total Debit must equal Total Credit' });
    }

    // Same def_voucher_type / Journal Cash-Bank checks as createVoucher —
    // an edit can change ledgers and amounts just as freely as a new entry.
    if (voucher.voucherType === 'Receipt') {
      const creditLegLedgerIds = entries.filter(e => (e.creditAmount || 0) > 0).map(e => e.ledgerId);
      if (creditLegLedgerIds.length) {
        const creditedLedgers = await Ledger.find({ _id: { $in: creditLegLedgerIds }, companyId: req.companyId }).select('ledgerName voucherType');
        const paymentOnlyLedger = creditedLedgers.find(l => l.voucherType === 'P');
        if (paymentOnlyLedger) {
          return res.status(400).json({
            success: false,
            message: `"${paymentOnlyLedger.ledgerName}" is a Payment-side ledger (def_voucher_type = P) and cannot be used as the head of account in a Receipt Voucher.`
          });
        }
      }
    }

    if (voucher.voucherType === 'Payment') {
      const debitLegLedgerIds = entries.filter(e => (e.debitAmount || 0) > 0).map(e => e.ledgerId);
      if (debitLegLedgerIds.length) {
        const debitedLedgers = await Ledger.find({ _id: { $in: debitLegLedgerIds }, companyId: req.companyId }).select('ledgerName voucherType');
        const receiptOnlyLedger = debitedLedgers.find(l => l.voucherType === 'R');
        if (receiptOnlyLedger) {
          return res.status(400).json({
            success: false,
            message: `"${receiptOnlyLedger.ledgerName}" is a Receipt-side ledger (def_voucher_type = R) and cannot be used as the head of account in a Payment Voucher.`
          });
        }
      }
    }

    if (voucher.voucherType === 'Journal') {
      const CASH_BANK_TYPES = ['Cash', 'Bank', 'Cash in Hand', 'Bank Accounts'];
      const journalLedgerIds = entries.map(e => e.ledgerId);
      const journalLedgers = await Ledger.find({ _id: { $in: journalLedgerIds }, companyId: req.companyId }).select('ledgerName ledgerType');
      const cashOrBankLedger = journalLedgers.find(l => CASH_BANK_TYPES.includes(l.ledgerType));
      if (cashOrBankLedger) {
        return res.status(400).json({
          success: false,
          message: `"${cashOrBankLedger.ledgerName}" is a Cash/Bank ledger and cannot be used in a Journal Voucher — use Receipt, Payment, or Contra instead.`
        });
      }
    }

    // Reverse the OLD entries' ledger balances before applying the new ones
    const reversedOldEntries = voucher.entries.map(e => ({
      ledgerId: e.ledgerId,
      debitAmount: e.creditAmount || 0,
      creditAmount: e.debitAmount || 0
    }));
    await updateLedgerBalances(reversedOldEntries, null, req.companyId);

    if (voucherDate) voucher.voucherDate = new Date(voucherDate);
    voucher.entries = entries;
    voucher.totalDebit = totalDebit;
    voucher.totalCredit = totalCredit;
    if (narration !== undefined) voucher.narration = narration;
    if (isMilkBill !== undefined) voucher.isMilkBill = !!isMilkBill;
    // Adjustment Entry now saves Receipt = Cr / Payment = Dr (see Voucher.adjSides)
    if (req.body.adjSides === 'v2') voucher.adjSides = 'v2';

    await voucher.save();
    await updateLedgerBalances(entries, null, req.companyId);

    res.status(200).json({
      success: true,
      message: 'Voucher updated successfully',
      data: voucher
    });
  } catch (error) {
    console.error('Error updating voucher:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating voucher'
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
