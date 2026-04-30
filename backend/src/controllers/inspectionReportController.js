import InspectionReport from '../models/InspectionReport.js';
import MilkCollection   from '../models/MilkCollection.js';
import MilkSales        from '../models/MilkSales.js';
import UnionSalesSlip   from '../models/UnionSalesSlip.js';
import Farmer           from '../models/Farmer.js';
import Advance          from '../models/Advance.js';

const f2   = v => +Number(v || 0).toFixed(2);
const isSC = c => /\bsc\b/i.test(c);
const isST = c => /\bst\b/i.test(c);

const dayRange = (dateStr) => {
  const d     = new Date(dateStr);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
};

// ── Compute live values from dairy data for a given date ─────────────────────
const computeFromData = async (companyId, date) => {
  const { start, end } = dayRange(date);
  const df   = { $gte: start, $lte: end };
  const base = { companyId };

  const [collections, salesDocs, unionSlips, allFarmers, cfAdvances] = await Promise.all([
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
  // LOCAL  → daily cash local sales (shops / route)
  // CREDIT → school / anganwadi (credit customer sales)
  // SAMPLE → production unit
  let locQ = 0, locA = 0, credQ = 0, credA = 0, sampQ = 0, sampA = 0;
  salesDocs.forEach(s => {
    const q = s.litre || 0, a = s.amount || 0;
    if (s.saleMode === 'LOCAL')  { locQ  += q; locA  += a; }
    if (s.saleMode === 'CREDIT') { credQ += q; credA += a; }
    if (s.saleMode === 'SAMPLE') { sampQ += q; sampA += a; }
  });

  // UnionSalesSlip → dairy/union sales
  let uniQ = 0, uniA = 0;
  unionSlips.forEach(u => { uniQ += (u.qty || 0); uniA += (u.amount || 0); });

  // ── Cattle Feed Advance Outstanding ────────────────────────────────────────
  const cfOutstanding = f2(cfAdvances.reduce((s, a) => s + (a.balanceAmount || 0), 0));

  // ── Auto-calculated totals ──────────────────────────────────────────────────
  const totalMilkQty          = f2(mQty + nmQty);
  const totalMilkAmount       = f2(nmAmt);                          // non-member cash purchase
  const totalSalesQty         = f2(locQ + credQ + sampQ + uniQ);
  const totalSalesAmount      = f2(locA + credA + sampA + uniA);
  const milkShortfallExcess   = f2(totalMilkQty - totalSalesQty);
  const dailyProfitMilkTrading= f2(totalSalesAmount - totalMilkAmount);

  return {
    membersMillingCount:          memberSet.size,
    membersMilkQty:               f2(mQty),
    nonMembersMillingCount:       nonMemberSet.size,
    nonMembersMilkQty:            f2(nmQty),
    nonMembersMilkPrice,
    totalMilkQty,
    totalMilkAmount,
    scStFarmersCount:             scStCount,
    scStMilkQty:                  f2(scStQty),
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
    cattleFeedAdvanceOutstanding: cfOutstanding,
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

    // 3. Merge: DB-computed values are primary source; saved values win only for
    //    text fields, financial fields, and explicit manual overrides (non-zero saved)
    const pick = (savedVal, liveVal) => {
      if (savedVal !== undefined && savedVal !== null && savedVal !== 0 && savedVal !== '')
        return savedVal;
      return liveVal;
    };

    const data = {
      _id:                          saved?._id   || null,
      dateOfInspection:             date,
      district:                     saved?.district          || '',
      society:                      saved?.society           || '',
      dairyDevelopmentUnit:         saved?.dairyDevelopmentUnit || '',
      nameOfSociety:                saved?.nameOfSociety     || '',

      // DB-primary fields (saved overrides only if non-zero)
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

      // Financial — saved values preferred; cattle feed from DB if no saved value
      cashBalanceAsOnDate:          saved?.cashBalanceAsOnDate       || 0,
      bankBalancePreviousMonth:     saved?.bankBalancePreviousMonth  || 0,
      cattleFeedAdvanceOutstanding: pick(saved?.cattleFeedAdvanceOutstanding, live.cattleFeedAdvanceOutstanding),
      producerDueAmountOutstanding: saved?.producerDueAmountOutstanding || 0,
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
