import InspectionReport from '../models/InspectionReport.js';
import MilkCollection   from '../models/MilkCollection.js';
import MilkSales        from '../models/MilkSales.js';
import UnionSalesSlip   from '../models/UnionSalesSlip.js';
import Farmer           from '../models/Farmer.js';
import Advance          from '../models/Advance.js';
import FarmerPayment    from '../models/FarmerPayment.js';
import Ledger           from '../models/Ledger.js';
import Voucher          from '../models/Voucher.js';
import Company          from '../models/Company.js';
import mongoose         from 'mongoose';

const f2   = v => +Number(v || 0).toFixed(2);
const isSC = c => /\bsc\b/i.test(c);
const isST = c => /\bst\b/i.test(c);

const dayRange = (dateStr) => {
  const d     = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// Sum of balances for ledgers of given types as of a specific date
const ledgerBalanceAsOf = async (companyId, ledgerTypes, asOfDate) => {
  const cid     = new mongoose.Types.ObjectId(String(companyId));
  const ledgers = await Ledger.find({
    companyId,
    ledgerType: { $in: ledgerTypes },
    status: 'Active',
  }).lean();
  if (!ledgers.length) return 0;

  const ledgerIds = ledgers.map(l => l._id);

  const entries = await Voucher.aggregate([
    { $match: { companyId: cid, voucherDate: { $lte: asOfDate }, status: 'Posted' } },
    { $unwind: '$entries' },
    { $match: { 'entries.ledgerId': { $in: ledgerIds } } },
    { $group: {
        _id:         '$entries.ledgerId',
        totalDebit:  { $sum: '$entries.debitAmount' },
        totalCredit: { $sum: '$entries.creditAmount' },
    }},
  ]);

  const entryMap = {};
  entries.forEach(e => { entryMap[String(e._id)] = e; });

  let total = 0;
  for (const ledger of ledgers) {
    const e   = entryMap[String(ledger._id)] || {};
    const dr  = e.totalDebit  || 0;
    const cr  = e.totalCredit || 0;
    const ob  = ledger.openingBalance || 0;
    // Assets (Cash, Bank) carry a Dr balance
    const obN = ledger.openingBalanceType === 'Dr' ? ob : -ob;
    total += obN + dr - cr;
  }
  return f2(Math.max(0, total));
};

// ── Compute live values from dairy data for a given date ─────────────────────
const computeFromData = async (companyId, date) => {
  const { start, end } = dayRange(date);
  const df   = { $gte: start, $lte: end };
  const base = { companyId };
  const cid  = new mongoose.Types.ObjectId(String(companyId));

  // Last day of the previous month (for bank balance field)
  const d            = new Date(date);
  const prevMonthEnd = new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);

  const [
    collections, salesDocs, unionSlips, allFarmers, cfAdvances,
    company, producerDueAgg,
    cashBal, bankBal,
  ] = await Promise.all([
    MilkCollection.find({ ...base, date: df })
      .populate('farmer', 'isMembership personalDetails.caste')
      .lean(),
    MilkSales.find({ ...base, date: df }).lean(),
    UnionSalesSlip.find({ ...base, date: df }).lean(),
    Farmer.find({ ...base, status: 'Active' })
      .select('isMembership personalDetails.caste')
      .lean(),
    Advance.find({
      ...base,
      advanceCategory: 'CF Advance',
      status: { $in: ['Active', 'Partially Adjusted', 'Overdue'] },
    }).lean(),
    Company.findById(companyId).lean(),
    FarmerPayment.aggregate([
      { $match: { companyId: cid, status: { $in: ['Pending', 'Partial'] } } },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
    ]),
    ledgerBalanceAsOf(companyId, ['Cash in Hand', 'Cash'], end),
    ledgerBalanceAsOf(companyId, ['Bank Accounts', 'Bank'], prevMonthEnd),
  ]);

  // ── Milk Collection ─────────────────────────────────────────────────────────
  const memberSet    = new Set();
  const nonMemberSet = new Set();
  let mQty = 0, nmQty = 0, nmAmt = 0;
  const farmerQtyMap = {};

  collections.forEach(c => {
    const fId = String(c.farmer?._id || c.farmerNumber || '');
    const qty = c.qty  || 0;
    const mem = c.farmer?.isMembership === true;
    farmerQtyMap[fId] = (farmerQtyMap[fId] || 0) + qty;
    if (mem) { memberSet.add(fId);    mQty  += qty; }
    else     { nonMemberSet.add(fId); nmQty += qty; nmAmt += (c.amount || 0); }
  });

  const nonMembersMilkPrice = nmQty > 0 ? f2(nmAmt / nmQty) : 0;

  // ── SC/ST ───────────────────────────────────────────────────────────────────
  const farmerMap = {};
  allFarmers.forEach(f => { farmerMap[String(f._id)] = f; });

  const activeFarmerIds = [
    ...Array.from(memberSet),
    ...Array.from(nonMemberSet),
  ].filter(id => /^[0-9a-fA-F]{24}$/.test(id));

  let scStCount = 0, scStQty = 0;
  activeFarmerIds.forEach(fId => {
    const f = farmerMap[fId];
    if (!f) return;
    const caste = (f.personalDetails?.caste || '').trim();
    const qty   = farmerQtyMap[fId] || 0;
    if (isSC(caste) || isST(caste)) { scStCount++; scStQty += qty; }
  });

  // ── Milk Sales ──────────────────────────────────────────────────────────────
  let locQ = 0, locA = 0, credQ = 0, credA = 0, sampQ = 0, sampA = 0;
  salesDocs.forEach(s => {
    const q = s.litre || 0, a = s.amount || 0;
    if (s.saleMode === 'LOCAL')  { locQ  += q; locA  += a; }
    if (s.saleMode === 'CREDIT') { credQ += q; credA += a; }
    if (s.saleMode === 'SAMPLE') { sampQ += q; sampA += a; }
  });

  let uniQ = 0, uniA = 0;
  unionSlips.forEach(u => { uniQ += (u.qty || 0); uniA += (u.amount || 0); });

  // ── Cattle Feed Advance Outstanding ─────────────────────────────────────────
  const cfOutstanding = f2(cfAdvances.reduce((s, a) => s + (a.balanceAmount || 0), 0));

  // ── Auto-calculated totals ──────────────────────────────────────────────────
  const totalMilkQty           = f2(mQty + nmQty);
  const totalMilkAmount        = f2(nmAmt);
  const totalSalesQty          = f2(locQ + credQ + sampQ + uniQ);
  const totalSalesAmount       = f2(locA + credA + sampA + uniA);
  const milkShortfallExcess    = f2(totalMilkQty - totalSalesQty);
  const dailyProfitMilkTrading = f2(totalSalesAmount - totalMilkAmount);

  return {
    // Company defaults (only used when no saved value)
    district:                     company?.district    || '',
    nameOfSociety:                company?.societyName || company?.companyName || '',
    dairyDevelopmentUnit:         company?.district    || '',

    // Milk collection
    membersMillingCount:          memberSet.size,
    membersMilkQty:               f2(mQty),
    nonMembersMillingCount:       nonMemberSet.size,
    nonMembersMilkQty:            f2(nmQty),
    nonMembersMilkPrice,
    totalMilkQty,
    totalMilkAmount,

    // SC/ST
    scStFarmersCount:             scStCount,
    scStMilkQty:                  f2(scStQty),

    // Sales
    localSalesQty:                f2(locQ),
    localSalesPrice:              f2(locA),
    schoolSalesQty:               f2(credQ),
    schoolSalesPrice:             f2(credA),
    productionUnitQty:            f2(sampQ),
    productionUnitPrice:          f2(sampA),
    dairySalesQty:                f2(uniQ),
    dairySalesPrice:              f2(uniA),
    totalSalesQty,
    totalSalesAmount,
    milkShortfallExcess,
    dailyProfitMilkTrading,

    // Financial — auto-computed from ledger & FarmerPayment
    cattleFeedAdvanceOutstanding: cfOutstanding,
    cashBalanceAsOnDate:          cashBal,
    bankBalancePreviousMonth:     bankBal,
    producerDueAmountOutstanding: f2(producerDueAgg[0]?.total || 0),
  };
};

// ── GET /api/inspection-report?date=YYYY-MM-DD ───────────────────────────────
export const getInspectionReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { date }  = req.query;

    if (!date) {
      const reports = await InspectionReport.find({ companyId })
        .sort({ dateOfInspection: -1 })
        .limit(30)
        .lean();
      return res.json({ success: true, data: reports });
    }

    const { start, end } = dayRange(date);

    // 1. Saved manual data
    const saved = await InspectionReport.findOne({
      companyId,
      dateOfInspection: { $gte: start, $lte: end },
    }).lean();

    // 2. Live computed data from dairy transactions
    const live = await computeFromData(companyId, date);

    // 3. Merge: saved non-zero values override computed; always re-compute totals
    const pick = (savedVal, liveVal) => {
      if (savedVal !== undefined && savedVal !== null && savedVal !== 0 && savedVal !== '')
        return savedVal;
      return liveVal;
    };

    const data = {
      _id:                          saved?._id   || null,
      dateOfInspection:             date,

      // Text fields: saved first, then company defaults
      district:             saved?.district          || live.district,
      society:              saved?.society            || '',
      dairyDevelopmentUnit: saved?.dairyDevelopmentUnit || live.dairyDevelopmentUnit,
      nameOfSociety:        saved?.nameOfSociety       || live.nameOfSociety,

      // DB-primary numeric fields (saved overrides only if non-zero)
      membersMillingCount:          pick(saved?.membersMillingCount,    live.membersMillingCount),
      membersMilkQty:               pick(saved?.membersMilkQty,         live.membersMilkQty),
      nonMembersMillingCount:       pick(saved?.nonMembersMillingCount,  live.nonMembersMillingCount),
      nonMembersMilkQty:            pick(saved?.nonMembersMilkQty,       live.nonMembersMilkQty),
      nonMembersMilkPrice:          pick(saved?.nonMembersMilkPrice,     live.nonMembersMilkPrice),

      // Always re-computed
      totalMilkQty:                 live.totalMilkQty,
      totalMilkAmount:              live.totalMilkAmount,

      scStFarmersCount:             pick(saved?.scStFarmersCount, live.scStFarmersCount),
      scStMilkQty:                  pick(saved?.scStMilkQty,      live.scStMilkQty),

      localSalesQty:                pick(saved?.localSalesQty,        live.localSalesQty),
      localSalesPrice:              pick(saved?.localSalesPrice,       live.localSalesPrice),
      schoolSalesQty:               pick(saved?.schoolSalesQty,        live.schoolSalesQty),
      schoolSalesPrice:             pick(saved?.schoolSalesPrice,      live.schoolSalesPrice),
      productionUnitQty:            pick(saved?.productionUnitQty,     live.productionUnitQty),
      productionUnitPrice:          pick(saved?.productionUnitPrice,   live.productionUnitPrice),
      dairySalesQty:                pick(saved?.dairySalesQty,         live.dairySalesQty),
      dairySalesPrice:              pick(saved?.dairySalesPrice,       live.dairySalesPrice),

      // Always re-computed
      totalSalesQty:                live.totalSalesQty,
      totalSalesAmount:             live.totalSalesAmount,
      milkShortfallExcess:          live.milkShortfallExcess,
      dailyProfitMilkTrading:       live.dailyProfitMilkTrading,

      // Financial — computed from ledger/advances; saved override if user manually entered
      cashBalanceAsOnDate:          pick(saved?.cashBalanceAsOnDate,      live.cashBalanceAsOnDate),
      bankBalancePreviousMonth:     pick(saved?.bankBalancePreviousMonth,  live.bankBalancePreviousMonth),
      cattleFeedAdvanceOutstanding: pick(saved?.cattleFeedAdvanceOutstanding, live.cattleFeedAdvanceOutstanding),

      // Producer due always live from FarmerPayment
      producerDueAmountOutstanding: live.producerDueAmountOutstanding,
    };

    res.json({ success: true, data });
  } catch (err) {
    console.error('Get inspection report error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/inspection-report ──────────────────────────────────────────────
export const saveInspectionReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { dateOfInspection, ...rest } = req.body;

    if (!dateOfInspection)
      return res.status(400).json({ success: false, message: 'dateOfInspection is required' });

    const { start, end } = dayRange(dateOfInspection);
    const doc = await InspectionReport.findOneAndUpdate(
      { companyId, dateOfInspection: { $gte: start, $lte: end } },
      { companyId, dateOfInspection: new Date(dateOfInspection), ...rest },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Save inspection report error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/inspection-report/:id ───────────────────────────────────────────
export const updateInspectionReport = async (req, res) => {
  try {
    const doc = await InspectionReport.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Update inspection report error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
