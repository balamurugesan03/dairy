import IncentiveRegister from '../models/IncentiveRegister.js';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import { generateCode } from '../models/Counter.js';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

const BANK_TYPES = ['Bank', 'Bank Accounts', 'Bank Account'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Fuzzy-matches the existing seeded ledger regardless of "FARMERS" vs
// "PRODUCERS" wording — mirrors the cfSalesLedger/cfAdvanceLedger lookup
// idiom already used in dayBookController.js / accountingReportsController.js.
async function getIncentiveLedger(companyId) {
  return Ledger.findOne({
    companyId,
    ledgerName: { $regex: /^addl\s*price\s*incentive\s*to\s*(farmers?|producers?)$/i },
  });
}

// ════════════════════════════════════════════════════════════════
//  GENERATE PREVIEW — computes rows, does not save
// ════════════════════════════════════════════════════════════════
export const generatePreview = async (req, res) => {
  try {
    const { fromDate, toDate, rate, partyFilter = 'All', centerId, basis = 'Qty' } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From date and To date are required' });
    }
    const incentiveRate = parseFloat(rate);
    if (!rate || isNaN(incentiveRate) || incentiveRate < 0) {
      return res.status(400).json({ success: false, message: 'A valid incentive rate is required' });
    }

    const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
    const end = new Date(toDate); end.setHours(23, 59, 59, 999);

    const agg = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end }, farmer: { $ne: null } } },
      { $group: { _id: '$farmer', milkQty: { $sum: '$qty' }, milkAmount: { $sum: '$amount' } } },
    ]);

    if (agg.length === 0) {
      return res.json({ success: true, data: { rows: [], totalQty: 0, totalAmount: 0, totalIncentiveAmount: 0 } });
    }

    const farmerIds = agg.map((a) => a._id);
    const farmers = await Farmer.find({ _id: { $in: farmerIds }, companyId })
      .populate('collectionCenter', 'centerName')
      .select('farmerNumber memberId personalDetails isMembership collectionCenter bankDetails')
      .lean();
    const farmerMap = new Map(farmers.map((f) => [f._id.toString(), f]));

    let rows = agg
      .map((a) => {
        const f = farmerMap.get(a._id.toString());
        if (!f) return null;
        return {
          farmerId: f._id,
          farmerNumber: f.farmerNumber || '',
          memberNo: f.memberId || '',
          farmerName: f.personalDetails?.name || '',
          centerName: f.collectionCenter?.centerName || '',
          isMembership: !!f.isMembership,
          centerIdStr: f.collectionCenter?._id ? f.collectionCenter._id.toString() : '',
          milkQty: round2(a.milkQty),
          milkAmount: round2(a.milkAmount),
          bankAccountNumber: f.bankDetails?.accountNumber || '',
          bankName: f.bankDetails?.bankName || '',
          bankBranch: f.bankDetails?.branch || '',
          bankIfsc: f.bankDetails?.ifsc || '',
        };
      })
      .filter(Boolean);

    // Farmer-type filter and Center filter are independent — both may apply together.
    if (partyFilter === 'Member') rows = rows.filter((r) => r.isMembership);
    else if (partyFilter === 'NonMember') rows = rows.filter((r) => !r.isMembership);
    if (centerId) rows = rows.filter((r) => r.centerIdStr === String(centerId));

    rows.sort((a, b) => (a.farmerNumber || '').localeCompare(b.farmerNumber || '', undefined, { numeric: true }));

    let totalQty = 0, totalAmount = 0, totalIncentiveAmount = 0;
    rows = rows.map((r, idx) => {
      const incentiveAmount = round2(incentiveRate * (basis === 'Amount' ? r.milkAmount : r.milkQty));
      totalQty += r.milkQty;
      totalAmount += r.milkAmount;
      totalIncentiveAmount += incentiveAmount;
      const { isMembership, centerIdStr, ...row } = r; // eslint-disable-line no-unused-vars
      return { slNo: idx + 1, ...row, incentiveAmount };
    });

    res.json({
      success: true,
      data: {
        rows,
        totalQty: round2(totalQty),
        totalAmount: round2(totalAmount),
        totalIncentiveAmount: round2(totalIncentiveAmount),
      },
    });
  } catch (error) {
    console.error('Error generating incentive register preview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE — save a generated register as Draft
// ════════════════════════════════════════════════════════════════
export const createRegister = async (req, res) => {
  const companyId = req.companyId;
  const {
    caption, fromDate, toDate, incentiveRate, partyFilter, centerId, centerName,
    basis, rows, totalQty, totalAmount, totalIncentiveAmount,
  } = req.body;

  if (!fromDate || !toDate || incentiveRate === undefined) {
    return res.status(400).json({ success: false, message: 'From date, To date and Incentive rate are required' });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const registerNumber = await generateCode('INC', companyId);
      const register = new IncentiveRegister({
        registerNumber,
        caption,
        fromDate,
        toDate,
        incentiveRate,
        partyFilter,
        centerId: centerId || undefined,
        centerName: centerId ? centerName : undefined,
        basis,
        rows: rows || [],
        totalQty: totalQty || 0,
        totalAmount: totalAmount || 0,
        totalIncentiveAmount: totalIncentiveAmount || 0,
        companyId,
        createdBy: req.user?._id,
      });
      await register.save();
      return res.status(201).json({ success: true, message: 'Incentive register saved', data: register });
    } catch (error) {
      if (error.code === 11000 && attempt < 4) continue;
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

// ════════════════════════════════════════════════════════════════
//  UPDATE — only while Draft
// ════════════════════════════════════════════════════════════════
export const updateRegister = async (req, res) => {
  try {
    const register = await IncentiveRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Incentive register not found' });
    if (register.status === 'Posted') {
      return res.status(400).json({ success: false, message: 'Cannot edit a posted register — cancel the posting first' });
    }

    const allowed = [
      'caption', 'fromDate', 'toDate', 'incentiveRate', 'partyFilter', 'centerId', 'centerName',
      'basis', 'rows', 'totalQty', 'totalAmount', 'totalIncentiveAmount',
    ];
    for (const field of allowed) {
      if (req.body[field] !== undefined) register[field] = req.body[field];
    }

    await register.save();
    res.json({ success: true, message: 'Incentive register updated', data: register });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET ALL — paginated
// ════════════════════════════════════════════════════════════════
export const getAll = async (req, res) => {
  try {
    const { page = 1, limit = 15, search = '', status } = req.query;
    const companyId = req.companyId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { companyId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { registerNumber: { $regex: search, $options: 'i' } },
        { caption: { $regex: search, $options: 'i' } },
      ];
    }

    const [registers, total] = await Promise.all([
      IncentiveRegister.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      IncentiveRegister.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: registers,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  GET BY ID
// ════════════════════════════════════════════════════════════════
export const getById = async (req, res) => {
  try {
    const register = await IncentiveRegister.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!register) return res.status(404).json({ success: false, message: 'Incentive register not found' });
    res.json({ success: true, data: register });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  DELETE — blocked while posted
// ════════════════════════════════════════════════════════════════
export const deleteRegister = async (req, res) => {
  try {
    const register = await IncentiveRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Incentive register not found' });
    if (register.posted) {
      return res.status(400).json({ success: false, message: 'Cannot delete a posted register — cancel the posting first' });
    }
    await register.deleteOne();
    res.json({ success: true, message: 'Incentive register deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  POST TO DAYBOOK — Cash: Dr Incentive Ledger / Cr Cash in Hand
//                    Bank: Dr Incentive Ledger / Cr Bank Ledger
// ════════════════════════════════════════════════════════════════
export const postToDaybook = async (req, res) => {
  try {
    const companyId = req.companyId;
    const register = await IncentiveRegister.findOne({ _id: req.params.id, companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Incentive register not found' });
    if (register.posted) {
      return res.status(400).json({ success: false, message: 'This register is already posted' });
    }
    if (!register.totalIncentiveAmount || register.totalIncentiveAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nothing to post — total incentive amount is zero' });
    }

    const { paymentMode, bankLedgerId, applyDate } = req.body;
    if (!['Cash', 'Bank'].includes(paymentMode)) {
      return res.status(400).json({ success: false, message: 'paymentMode must be Cash or Bank' });
    }
    if (paymentMode === 'Bank' && !bankLedgerId) {
      return res.status(400).json({ success: false, message: 'Please select a Bank Ledger' });
    }
    let effectiveDate = new Date();
    if (applyDate) {
      const parsed = new Date(applyDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid Apply Date' });
      }
      effectiveDate = parsed;
    }

    const incentiveLedger = await getIncentiveLedger(companyId);
    if (!incentiveLedger) {
      return res.status(404).json({
        success: false,
        message: 'ADDL PRICE INCENTIVE TO FARMERS ledger not found — run the ledger seeding for this company first',
      });
    }

    let payLedger;
    if (paymentMode === 'Cash') {
      payLedger = await Ledger.findOne({ ledgerType: 'Cash', status: 'Active', companyId });
      if (!payLedger) {
        payLedger = await new Ledger({
          ledgerName: 'Cash in Hand',
          ledgerType: 'Cash',
          parentGroup: 'ASSET',
          openingBalance: 0,
          currentBalance: 0,
          balanceType: 'Dr',
          openingBalanceType: 'Dr',
          status: 'Active',
          companyId,
        }).save();
      }
    } else {
      payLedger = await Ledger.findOne({ _id: bankLedgerId, companyId });
      if (!payLedger || !BANK_TYPES.includes(payLedger.ledgerType)) {
        return res.status(400).json({ success: false, message: 'Selected Bank Ledger was not found' });
      }
    }

    const amount = register.totalIncentiveAmount;
    const narration = `Incentive Register — ${register.caption} (${new Date(register.fromDate).toLocaleDateString('en-IN')}-${new Date(register.toDate).toLocaleDateString('en-IN')})`;

    const entries = [
      { ledgerId: incentiveLedger._id, ledgerName: incentiveLedger.ledgerName, debitAmount: amount, creditAmount: 0, narration },
      { ledgerId: payLedger._id, ledgerName: payLedger.ledgerName, debitAmount: 0, creditAmount: amount, narration },
    ];

    const postedAt = effectiveDate;
    const voucher = new Voucher({
      voucherType: 'Payment',
      voucherNumber: await generateVoucherNumber('Payment', companyId),
      voucherDate: postedAt,
      entries,
      totalDebit: amount,
      totalCredit: amount,
      narration,
      referenceType: 'IncentiveRegister',
      referenceId: register._id,
      referenceNumber: register.registerNumber,
      companyId,
    });
    await voucher.save();
    await updateLedgerBalances(entries, null, companyId);

    register.posted = true;
    register.postedAt = postedAt;
    register.voucherId = voucher._id;
    register.paymentMode = paymentMode;
    if (paymentMode === 'Bank') {
      register.bankLedgerId = payLedger._id;
      register.bankLedgerName = payLedger.ledgerName;
    }
    register.status = 'Posted';
    await register.save();

    res.json({ success: true, message: 'Posted to Daybook successfully', data: register });
  } catch (error) {
    console.error('Error posting incentive register to daybook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CANCEL POSTING — reverse the voucher, unpost the register
// ════════════════════════════════════════════════════════════════
export const cancelPosting = async (req, res) => {
  try {
    const companyId = req.companyId;
    const register = await IncentiveRegister.findOne({ _id: req.params.id, companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Incentive register not found' });
    if (!register.posted) {
      return res.status(400).json({ success: false, message: 'This register is not posted' });
    }

    if (register.voucherId) {
      const voucher = await Voucher.findOne({ _id: register.voucherId, companyId });
      if (voucher) {
        const reversed = voucher.entries.map((e) => ({
          ledgerId: e.ledgerId,
          debitAmount: e.creditAmount || 0,
          creditAmount: e.debitAmount || 0,
        }));
        await updateLedgerBalances(reversed, null, companyId);
        await voucher.deleteOne();
      }
    }

    register.posted = false;
    register.postedAt = undefined;
    register.voucherId = undefined;
    register.status = 'Draft';
    await register.save();

    res.json({ success: true, message: 'Posting cancelled', data: register });
  } catch (error) {
    console.error('Error cancelling incentive register posting:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBankLedgers = async (req, res) => {
  try {
    const ledgers = await Ledger.find({
      companyId: req.companyId,
      status: 'Active',
      ledgerType: { $in: BANK_TYPES },
    }).select('ledgerName ledgerType').sort({ ledgerName: 1 }).lean();
    res.json({ success: true, data: ledgers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  generatePreview,
  createRegister,
  updateRegister,
  getAll,
  getById,
  deleteRegister,
  postToDaybook,
  cancelPosting,
  getBankLedgers,
};
