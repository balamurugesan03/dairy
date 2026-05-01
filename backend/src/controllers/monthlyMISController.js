import MilkCollection   from '../models/MilkCollection.js';
import MilkSales        from '../models/MilkSales.js';
import Farmer           from '../models/Farmer.js';
import Voucher          from '../models/Voucher.js';

const f2 = v => +Number(v || 0).toFixed(2);

const EXPENSE_TYPES = ['Trade Expenses', 'Contingencies', 'Expense', 'Miscellaneous Expenses', 'Establishment Charges'];
const SALARY_TYPES  = ['Establishment Charges'];
const INCOME_TYPES  = ['Trade Income', 'Miscellaneous Income', 'Income', 'Other Revenue', 'Sales A/c'];

const sumByType = (vouchers, types, side) =>
  vouchers.reduce((tot, v) => {
    (v.entries || []).forEach(e => {
      if (!e.ledgerId) return;
      if (types.includes(e.ledgerId.ledgerType))
        tot += side === 'credit' ? (e.creditAmount || 0) : (e.debitAmount || 0);
    });
    return tot;
  }, 0);

// GET /api/reports/monthly-mis?month=&year=
export const getMonthlyMISReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year)  || new Date().getFullYear();

    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end   = new Date(y, m, 0, 23, 59, 59, 999);
    const df    = { $gte: start, $lte: end };
    const base  = { companyId };

    const [allFarmers, collections, salesDocs, vouchers] = await Promise.all([
      Farmer.find({ ...base, status: 'Active' })
        .select('isMembership personalDetails.gender personalDetails.caste').lean(),
      MilkCollection.find({ ...base, date: df })
        .populate('farmer', 'isMembership').lean(),
      MilkSales.find({ ...base, date: df }).lean(),
      Voucher.find({ ...base, voucherDate: df })
        .populate('entries.ledgerId', 'ledgerName ledgerType').lean(),
    ]);

    // ── Member statistics ──────────────────────────────────────────────
    const totalRegisteredMembers = allFarmers.filter(f => f.isMembership).length;
    const maleMembers   = allFarmers.filter(f => f.isMembership && f.personalDetails?.gender === 'Male').length;
    const femaleMembers = allFarmers.filter(f => f.isMembership && f.personalDetails?.gender === 'Female').length;
    const scMembers     = allFarmers.filter(f => f.isMembership && /\bsc\b/i.test(f.personalDetails?.caste || '')).length;
    const stMembers     = allFarmers.filter(f => f.isMembership && /\bst\b/i.test(f.personalDetails?.caste || '')).length;
    const obcMembers    = allFarmers.filter(f => f.isMembership && /\bobc\b/i.test(f.personalDetails?.caste || '')).length;

    // ── Procurement breakdown ──────────────────────────────────────────
    let memberQty = 0, memberAmt = 0;
    let nonMemberQty = 0, nonMemberAmt = 0;
    let totalFatWt = 0, totalSnfWt = 0;
    const pouringMemberIds    = new Set();
    const pouringNonMemberIds = new Set();

    collections.forEach(c => {
      const qty = c.qty    || 0;
      const amt = c.amount || 0;
      const fat = c.fat    || 0;
      const snf = c.snf    || 0;
      const isMem = c.farmer?.isMembership === true;
      const fKey  = String(c.farmer?._id || c.farmerNumber || '');

      totalFatWt += fat * qty;
      totalSnfWt += snf * qty;

      if (isMem) {
        memberQty += qty; memberAmt += amt;
        if (fKey) pouringMemberIds.add(fKey);
      } else {
        nonMemberQty += qty; nonMemberAmt += amt;
        if (fKey) pouringNonMemberIds.add(fKey);
      }
    });

    const totalQty = memberQty + nonMemberQty;
    const totalAmt = memberAmt + nonMemberAmt;
    const avgFat   = totalQty > 0 ? f2(totalFatWt / totalQty) : 0;
    const avgSnf   = totalQty > 0 ? f2(totalSnfWt / totalQty) : 0;

    // ── Sales breakdown ────────────────────────────────────────────────
    const sum = (arr, key) => f2(arr.reduce((t, s) => t + (s[key] || 0), 0));
    const localSales  = salesDocs.filter(s => s.saleMode === 'LOCAL');
    const creditSales = salesDocs.filter(s => s.saleMode === 'CREDIT');
    const sampleSales = salesDocs.filter(s => s.saleMode === 'SAMPLE');

    const localLitre  = sum(localSales,  'litre');
    const creditLitre = sum(creditSales, 'litre');
    const sampleLitre = sum(sampleSales, 'litre');
    const localAmt    = sum(localSales,  'amount');
    const creditAmt   = sum(creditSales, 'amount');
    const sampleAmt   = sum(sampleSales, 'amount');
    const dairyLitre  = f2(Math.max(0, totalQty - localLitre - creditLitre - sampleLitre));

    // ── Voucher-based financials ───────────────────────────────────────
    const tradeExpenses = f2(sumByType(vouchers, EXPENSE_TYPES.filter(t => !SALARY_TYPES.includes(t)), 'debit'));
    const salary        = f2(sumByType(vouchers, SALARY_TYPES,  'debit'));
    const otherIncome   = f2(sumByType(vouchers, INCOME_TYPES,  'credit'));

    const avgPricePaidToFarmer = totalQty > 0 ? f2(totalAmt / totalQty) : 0;

    res.json({
      success: true,
      data: {
        // Procurement
        memberQty:    f2(memberQty),
        nonMemberQty: f2(nonMemberQty),
        totalQty:     f2(totalQty),
        localLitre,
        creditLitre,
        sampleLitre,
        dairyLitre,
        avgFat,
        avgSnf,
        // Members
        totalRegisteredMembers,
        pouringMembers:    pouringMemberIds.size,
        pouringNonMembers: pouringNonMemberIds.size,
        maleMembers,
        femaleMembers,
        scMembers,
        stMembers,
        obcMembers,
        // Financial
        memberAmt:    f2(memberAmt),
        nonMemberAmt: f2(nonMemberAmt),
        totalAmt:     f2(totalAmt),
        localAmt,
        creditAmt,
        sampleAmt,
        tradeExpenses,
        salary,
        otherIncome,
        avgPricePaidToFarmer,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
