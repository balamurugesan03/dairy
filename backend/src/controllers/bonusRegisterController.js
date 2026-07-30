import BonusRegister from '../models/BonusRegister.js';
import Farmer from '../models/Farmer.js';
import MilkCollection from '../models/MilkCollection.js';
import Ledger from '../models/Ledger.js';
import Voucher from '../models/Voucher.js';
import { generateCode } from '../models/Counter.js';
import { generateVoucherNumber, updateLedgerBalances } from '../utils/accountingHelper.js';

const BANK_TYPES = ['Bank', 'Bank Accounts', 'Bank Account'];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Fuzzy-matches the existing seeded ledger regardless of "MEMBER" vs
// "MEMBERS" wording — mirrors the ADDL PRICE INCENTIVE lookup idiom used
// for the Incentive Register.
async function getBonusLedger(companyId) {
  return Ledger.findOne({
    companyId,
    ledgerName: { $regex: /^members?\s*bonus$/i },
  });
}

// ════════════════════════════════════════════════════════════════
//  GENERATE PREVIEW — computes rows, does not save
// ════════════════════════════════════════════════════════════════
export const generatePreview = async (req, res) => {
  try {
    const {
      fromDate, toDate, rateMode = 'Percentage', rate, percent,
      partyFilter = 'All', centerId, basis = 'Qty',
      dividendEnabled, dividendPercent,
    } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From date and To date are required' });
    }

    const isPercent = rateMode === 'Percentage';
    const bonusRate = parseFloat(rate) || 0;
    const bonusPercent = parseFloat(percent) || 0;
    if (isPercent && (!percent || bonusPercent < 0)) {
      return res.status(400).json({ success: false, message: 'A valid Bonus % is required' });
    }
    if (!isPercent && (!rate || bonusRate < 0)) {
      return res.status(400).json({ success: false, message: 'A valid Bonus Rate is required' });
    }
    const isDividend = dividendEnabled === 'true' || dividendEnabled === true;
    const divPercent = parseFloat(dividendPercent) || 0;
    if (isDividend && (!dividendPercent || divPercent < 0)) {
      return res.status(400).json({ success: false, message: 'A valid Dividend % is required' });
    }
    // Percentage mode always applies against milk Amount — a % of Qty has no currency meaning.
    const effectiveBasis = isPercent ? 'Amount' : basis;

    const start = new Date(fromDate); start.setHours(0, 0, 0, 0);
    const end = new Date(toDate); end.setHours(23, 59, 59, 999);

    const agg = await MilkCollection.aggregate([
      { $match: { companyId, date: { $gte: start, $lte: end }, farmer: { $ne: null } } },
      { $group: { _id: '$farmer', milkQty: { $sum: '$qty' }, milkAmount: { $sum: '$amount' } } },
    ]);

    if (agg.length === 0) {
      return res.json({
        success: true,
        data: { rows: [], totalQty: 0, totalAmount: 0, totalBonusAmount: 0, totalDividendAmount: 0, totalPostAmount: 0 },
      });
    }

    const farmerIds = agg.map((a) => a._id);
    const farmers = await Farmer.find({ _id: { $in: farmerIds }, companyId })
      .populate('collectionCenter', 'centerName')
      .select('farmerNumber memberId personalDetails isMembership membershipDate collectionCenter bankDetails')
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
          membershipDate: f.membershipDate || null,
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

    // A farmer counts as a "Member" for this report only if their membership
    // date falls on/before the selected period's end — reflects who was
    // actually a member during that period, not just who is a member today.
    // Legacy records without a recorded membershipDate fall back to the flag.
    const isMemberAsOf = (r) => (r.membershipDate ? new Date(r.membershipDate) <= end : r.isMembership);

    // Farmer-type filter and Center filter are independent — both may apply together.
    if (partyFilter === 'Member') rows = rows.filter((r) => isMemberAsOf(r));
    else if (partyFilter === 'NonMember') rows = rows.filter((r) => !isMemberAsOf(r));
    if (centerId) rows = rows.filter((r) => r.centerIdStr === String(centerId));

    rows.sort((a, b) => (a.farmerNumber || '').localeCompare(b.farmerNumber || '', undefined, { numeric: true }));

    let totalQty = 0, totalAmount = 0, totalBonusAmount = 0, totalDividendAmount = 0, totalPostAmount = 0;
    rows = rows.map((r, idx) => {
      const bonusAmount = isPercent
        ? round2(r.milkAmount * (bonusPercent / 100))
        : round2(bonusRate * (effectiveBasis === 'Amount' ? r.milkAmount : r.milkQty));
      const dividendAmount = isDividend ? round2(r.milkAmount * (divPercent / 100)) : 0;
      const totalAmt = round2(bonusAmount + dividendAmount);

      totalQty += r.milkQty;
      totalAmount += r.milkAmount;
      totalBonusAmount += bonusAmount;
      totalDividendAmount += dividendAmount;
      totalPostAmount += totalAmt;

      const { isMembership, membershipDate, centerIdStr, ...row } = r; // eslint-disable-line no-unused-vars
      return { slNo: idx + 1, ...row, bonusAmount, dividendAmount, totalAmount: totalAmt };
    });

    res.json({
      success: true,
      data: {
        rows,
        totalQty: round2(totalQty),
        totalAmount: round2(totalAmount),
        totalBonusAmount: round2(totalBonusAmount),
        totalDividendAmount: round2(totalDividendAmount),
        totalPostAmount: round2(totalPostAmount),
      },
    });
  } catch (error) {
    console.error('Error generating bonus register preview:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CREATE — save a generated register as Draft
// ════════════════════════════════════════════════════════════════
export const createRegister = async (req, res) => {
  const companyId = req.companyId;
  const {
    caption, fromDate, toDate, rateMode, bonusRate, bonusPercent, basis,
    dividendEnabled, dividendPercent,
    partyFilter, centerId, centerName,
    rows, totalQty, totalAmount, totalBonusAmount, totalDividendAmount, totalPostAmount,
  } = req.body;

  if (!fromDate || !toDate) {
    return res.status(400).json({ success: false, message: 'From date and To date are required' });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const registerNumber = await generateCode('BNS', companyId);
      const register = new BonusRegister({
        registerNumber,
        caption,
        fromDate,
        toDate,
        rateMode,
        bonusRate: bonusRate || 0,
        bonusPercent: bonusPercent || 0,
        basis,
        dividendEnabled: !!dividendEnabled,
        dividendPercent: dividendPercent || 0,
        partyFilter,
        centerId: centerId || undefined,
        centerName: centerId ? centerName : undefined,
        rows: rows || [],
        totalQty: totalQty || 0,
        totalAmount: totalAmount || 0,
        totalBonusAmount: totalBonusAmount || 0,
        totalDividendAmount: totalDividendAmount || 0,
        totalPostAmount: totalPostAmount || 0,
        companyId,
        createdBy: req.user?._id,
      });
      await register.save();
      return res.status(201).json({ success: true, message: 'Bonus register saved', data: register });
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
    const register = await BonusRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Bonus register not found' });
    if (register.status === 'Posted') {
      return res.status(400).json({ success: false, message: 'Cannot edit a posted register — cancel the posting first' });
    }

    const allowed = [
      'caption', 'fromDate', 'toDate', 'rateMode', 'bonusRate', 'bonusPercent', 'basis',
      'dividendEnabled', 'dividendPercent', 'partyFilter', 'centerId', 'centerName',
      'rows', 'totalQty', 'totalAmount', 'totalBonusAmount', 'totalDividendAmount', 'totalPostAmount',
    ];
    for (const field of allowed) {
      if (req.body[field] !== undefined) register[field] = req.body[field];
    }

    await register.save();
    res.json({ success: true, message: 'Bonus register updated', data: register });
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
      BonusRegister.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      BonusRegister.countDocuments(filter),
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
    const register = await BonusRegister.findOne({ _id: req.params.id, companyId: req.companyId }).lean();
    if (!register) return res.status(404).json({ success: false, message: 'Bonus register not found' });
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
    const register = await BonusRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Bonus register not found' });
    if (register.posted) {
      return res.status(400).json({ success: false, message: 'Cannot delete a posted register — cancel the posting first' });
    }
    await register.deleteOne();
    res.json({ success: true, message: 'Bonus register deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  POST TO DAYBOOK — Cash: Dr MEMBERS BONUS / Cr Cash in Hand
//                    Bank: Dr MEMBERS BONUS / Cr Bank Ledger
//  Posts the combined Bonus + Dividend total (totalPostAmount) — the
//  spec calls for one grand total posting against the MEMBERS BONUS ledger.
// ════════════════════════════════════════════════════════════════
export const postToDaybook = async (req, res) => {
  try {
    const companyId = req.companyId;
    const register = await BonusRegister.findOne({ _id: req.params.id, companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Bonus register not found' });
    if (register.posted) {
      return res.status(400).json({ success: false, message: 'This register is already posted' });
    }
    if (!register.totalPostAmount || register.totalPostAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Nothing to post — total amount is zero' });
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

    const bonusLedger = await getBonusLedger(companyId);
    if (!bonusLedger) {
      return res.status(404).json({
        success: false,
        message: 'MEMBERS BONUS ledger not found — run the ledger seeding for this company first',
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

    const amount = register.totalPostAmount;
    const narration = `Bonus Register — ${register.caption} (${new Date(register.fromDate).toLocaleDateString('en-IN')}-${new Date(register.toDate).toLocaleDateString('en-IN')})`;

    const entries = [
      { ledgerId: bonusLedger._id, ledgerName: bonusLedger.ledgerName, debitAmount: amount, creditAmount: 0, narration },
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
      referenceType: 'BonusRegister',
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
    console.error('Error posting bonus register to daybook:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  CANCEL POSTING — reverse the voucher, unpost the register
// ════════════════════════════════════════════════════════════════
export const cancelPosting = async (req, res) => {
  try {
    const companyId = req.companyId;
    const register = await BonusRegister.findOne({ _id: req.params.id, companyId });
    if (!register) return res.status(404).json({ success: false, message: 'Bonus register not found' });
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
    console.error('Error cancelling bonus register posting:', error);
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
