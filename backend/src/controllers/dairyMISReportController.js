import DairyMISReport   from '../models/DairyMISReport.js';
import MilkCollection   from '../models/MilkCollection.js';
import MilkSales        from '../models/MilkSales.js';
import UnionSalesSlip   from '../models/UnionSalesSlip.js';
import Farmer           from '../models/Farmer.js';
import Item             from '../models/Item.js';
import StockTransaction from '../models/StockTransaction.js';
import Voucher          from '../models/Voucher.js';
import Ledger           from '../models/Ledger.js';
import PaymentRegister  from '../models/PaymentRegister.js';

// ── tiny helpers ──────────────────────────────────────────────────────────────
const f2  = v => +Number(v || 0).toFixed(2);
const f3  = v => +Number(v || 0).toFixed(3);

// Ledger types that represent "other income" in the dairy cooperative
const INCOME_TYPES  = ['Trade Income', 'Miscellaneous Income', 'Income', 'Other Revenue',
                       'Grants & Aid', 'Subsidies', 'Sales A/c'];
// Ledger types for all trade/indirect expenses
const EXPENSE_TYPES = ['Trade Expenses', 'Contingencies', 'Expense',
                       'Miscellaneous Expenses', 'Establishment Charges'];
// Salary & allowances specifically
const SALARY_TYPES  = ['Establishment Charges'];

// Caste category helper (handles free-text caste values)
const isSC = c => /\bsc\b/i.test(c);
const isST = c => /\bst\b/i.test(c);

// Sum voucher entries by ledger type list (side = 'credit' | 'debit')
const sumByType = (vouchers, types, side) =>
  vouchers.reduce((tot, v) => {
    (v.entries || []).forEach(e => {
      if (!e.ledgerId) return;
      if (types.includes(e.ledgerId.ledgerType))
        tot += side === 'credit' ? (e.creditAmount || 0) : (e.debitAmount || 0);
    });
    return tot;
  }, 0);

// ── GET /api/reports/ddd-mis-report?month=&year= ─────────────────────────────
export const getDDDMISReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const m = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const y = parseInt(req.query.year)  || new Date().getFullYear();

    // ── Date windows ──────────────────────────────────────────────────────
    const start   = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end     = new Date(y, m, 0, 23, 59, 59, 999);
    const lmStart = new Date(y, m - 2, 1, 0, 0, 0, 0);
    const lmEnd   = new Date(y, m - 1, 0, 23, 59, 59, 999);
    const days    = new Date(y, m, 0).getDate();      // days in current month
    const df      = { $gte: start, $lte: end };
    const ldf     = { $gte: lmStart, $lte: lmEnd };
    const base    = { companyId };

    // ── Load saved manual overrides ───────────────────────────────────────
    const saved = await DairyMISReport.findOne({ ...base, month: m, year: y }).lean();

    // ── Parallel data fetch ───────────────────────────────────────────────
    const [
      allFarmers,
      collections,
      lmCollections,
      salesDocs,
      lmSalesDocs,
      unionSlips,
      lmUnionSlips,
      allItems,
      pTxns,
      sTxns,
      vouchers,
      lmVouchers,
      payRegs,
      lmPayRegs,
    ] = await Promise.all([
      Farmer.find({ ...base }).select('isMembership personalDetails.gender personalDetails.caste').lean(),
      MilkCollection.find({ ...base, date: df })
        .populate('farmer', 'isMembership personalDetails.gender personalDetails.caste').lean(),
      MilkCollection.find({ ...base, date: ldf })
        .populate('farmer', 'isMembership personalDetails.gender personalDetails.caste').lean(),
      MilkSales.find({ ...base, date: df }).lean(),
      MilkSales.find({ ...base, date: ldf }).lean(),
      UnionSalesSlip.find({ ...base, date: df }).lean(),
      UnionSalesSlip.find({ ...base, date: ldf }).lean(),
      Item.find({ ...base }).lean(),
      StockTransaction.find({ ...base, date: df, transactionType: 'Stock In' }).lean(),
      StockTransaction.find({ ...base, date: df, transactionType: 'Stock Out' }).lean(),
      Voucher.find({ ...base, voucherDate: df })
        .populate('entries.ledgerId', 'ledgerName ledgerType').lean(),
      Voucher.find({ ...base, voucherDate: ldf })
        .populate('entries.ledgerId', 'ledgerName ledgerType').lean(),
      PaymentRegister.find({ ...base, fromDate: { $gte: start, $lte: end } }).lean(),
      PaymentRegister.find({ ...base, fromDate: { $gte: lmStart, $lte: lmEnd } }).lean(),
    ]);

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 1 — Milk Purchase Summary
    // ════════════════════════════════════════════════════════════════════════
    const totalMem    = allFarmers.filter(f => f.isMembership).length;
    const totalNonMem = allFarmers.length - totalMem;

    const memberSet    = new Set();
    const nonMemberSet = new Set();
    let mQty = 0, mAmt = 0, nmQty = 0, nmAmt = 0;
    let mFatSum = 0, mSnfSum = 0, nmFatSum = 0, nmSnfSum = 0;

    const farmerQtyMap = {};   // farmerId → total qty poured this month

    collections.forEach(c => {
      const fId  = String(c.farmer?._id || c.farmerNumber || '');
      const qty  = c.qty    || 0;
      const amt  = c.amount || 0;
      const fat  = c.fat    || 0;
      const snf  = c.snf    || 0;
      const mem  = c.farmer?.isMembership === true;

      farmerQtyMap[fId] = (farmerQtyMap[fId] || 0) + qty;

      if (mem) {
        memberSet.add(fId); mQty += qty; mAmt += amt;
        mFatSum += fat * qty; mSnfSum += snf * qty;
      } else {
        nonMemberSet.add(fId); nmQty += qty; nmAmt += amt;
        nmFatSum += fat * qty; nmSnfSum += snf * qty;
      }
    });

    const totQ = mQty + nmQty;
    const totA = mAmt + nmAmt;

    const section1 = {
      totalRegisteredMembers: { members: totalMem,         nonMembers: totalNonMem,       total: allFarmers.length },
      milkPouringMembers:     { members: memberSet.size,   nonMembers: nonMemberSet.size,  total: memberSet.size + nonMemberSet.size },
      totalMilkPurchaseLtr:   { members: f2(mQty),         nonMembers: f2(nmQty),          total: f2(totQ) },
      totalMilkPurchaseValue: { members: f2(mAmt),         nonMembers: f2(nmAmt),          total: f2(totA) },
    };

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 2 — Milk Purchase by Category (SC / ST / Female / Male)
    // ════════════════════════════════════════════════════════════════════════
    const activeFarmerIds = [
      ...Array.from(memberSet),
      ...Array.from(nonMemberSet),
    ].filter(id => /^[0-9a-fA-F]{24}$/.test(id));

    // Build a quick lookup for farmer details
    const farmerMap = {};
    allFarmers.forEach(f => { farmerMap[String(f._id)] = f; });

    let scNos = 0, stNos = 0, femNos = 0, malNos = 0;
    let scQty = 0, stQty = 0, femQty = 0, malQty = 0;

    activeFarmerIds.forEach(fId => {
      const f     = farmerMap[fId];
      if (!f) return;
      const caste = (f.personalDetails?.caste || '').trim();
      const isFem = (f.personalDetails?.gender || '') === 'Female';
      const qty   = farmerQtyMap[fId] || 0;

      if (isSC(caste)) { scNos++; scQty += qty; }
      if (isST(caste)) { stNos++; stQty += qty; }
      if (isFem) { femNos++; femQty += qty; }
      else       { malNos++; malQty += qty; }
    });

    const section2 = {
      nos:          { sc: scNos,       st: stNos,       female: femNos,       male: malNos,       total: activeFarmerIds.length },
      milkQuantity: { sc: f2(scQty),   st: f2(stQty),   female: f2(femQty),   male: f2(malQty),   total: f2(totQ) },
    };

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 3 — Milk Sales
    // ════════════════════════════════════════════════════════════════════════
    let locQ = 0, locA = 0, credQ = 0, credA = 0, sampQ = 0, sampA = 0;
    salesDocs.forEach(s => {
      const q = s.litre || 0, a = s.amount || 0;
      if (s.saleMode === 'LOCAL')  { locQ  += q; locA  += a; }
      if (s.saleMode === 'CREDIT') { credQ += q; credA += a; }
      if (s.saleMode === 'SAMPLE') { sampQ += q; sampA += a; }
    });

    let uniQ = 0, uniA = 0, uniFatSum = 0, uniSnfSum = 0;
    unionSlips.forEach(u => {
      const q = u.qty || 0;
      uniQ += q; uniA += u.amount || 0;
      uniFatSum += (u.fat || 0) * q;
      uniSnfSum += (u.snf || 0) * q;
    });

    // Total Sales = Local + School(CREDIT) + Product(SAMPLE) + From Dairy(09b=0)
    const totSalesQ = locQ + credQ + sampQ;          // 09b (fromDairy) not tracked in DB
    const totSalesA = locA + credA + sampA;
    // Grand total including union
    const grandSalesQ = totSalesQ + uniQ;
    const grandSalesA = totSalesA + uniA;

    const avgLD = (q) => days > 0 ? f2(q / days) : 0;
    const mkSRow = (q, a) => ({ quantity: f2(q), value: f2(a), avgLDay: avgLD(q) });

    // 10.1  Milk Sales Income = Total Sales Value − Total Milk Purchase Value
    const milkSalesIncome = f2(grandSalesA - totA);

    const section3 = {
      localSales:       mkSRow(locQ,   locA),
      schoolSales:      mkSRow(credQ,  credA),
      productUnitSales: mkSRow(sampQ,  sampA),
      toDairy:          mkSRow(uniQ,   uniA),
      fromDairy:        mkSRow(0, 0),                // manual / not tracked
      totalSales:       mkSRow(grandSalesQ, grandSalesA),
      milkSalesIncome:  { quantity: 0, value: milkSalesIncome, avgLDay: 0 },
    };

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 4 — Milk Quality
    // ════════════════════════════════════════════════════════════════════════
    // Society quality = weighted average from all MilkCollections this month
    const totalFatSum = mFatSum + nmFatSum;
    const totalSnfSum = mSnfSum + nmSnfSum;
    const socFat  = totQ > 0 ? f3(totalFatSum / totQ) : 0;
    const socSnf  = totQ > 0 ? f3(totalSnfSum / totQ) : 0;
    const socRate = totQ > 0 ? f2(totA / totQ) : 0;

    // MILMA / Union quality = weighted average from UnionSalesSlip
    const milmaFat  = uniQ > 0 ? f3(uniFatSum / uniQ) : 0;
    const milmaSnf  = uniQ > 0 ? f3(uniSnfSum / uniQ) : 0;
    const milmaRate = uniQ > 0 ? f2(uniA / uniQ) : 0;

    const section4 = {
      qualityFromMilma:   { fat: milmaFat, snf: milmaSnf, avgPriceLtr: milmaRate },
      societyWiseQuality: { fat: socFat,   snf: socSnf,   avgPriceLtr: socRate   },
    };

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 5 — Other Business (Cattle Feed & Mineral)
    // ════════════════════════════════════════════════════════════════════════
    // Categorise items by their category field (case-insensitive matching)
    const cfRe  = /cattle\s*feed|cf\b|cattle/i;
    const mnRe  = /mineral|min\s*mix|salt/i;

    const cfItems = allItems.filter(it => cfRe.test(it.category || '') || cfRe.test(it.itemName || ''));
    const mnItems = allItems.filter(it => mnRe.test(it.category || '') || mnRe.test(it.itemName || ''));
    const cfIds   = new Set(cfItems.map(it => String(it._id)));
    const mnIds   = new Set(mnItems.map(it => String(it._id)));

    const sumTxnAmt  = (txns, idSet) =>
      txns.filter(t => idSet.has(String(t.itemId)))
          .reduce((s, t) => s + (t.quantity || 0) * (t.rate || 0), 0);

    const stockVal = (items) =>
      items.reduce((s, it) => s + (it.currentBalance || 0) * (it.costPrice || it.purchasePrice || 0), 0);

    const openVal = (items, purTxns, salTxns) =>
      items.reduce((s, it) => {
        const sid = String(it._id);
        const pQ  = purTxns.filter(t => String(t.itemId) === sid).reduce((a, t) => a + (t.quantity || 0), 0);
        const sQ  = salTxns.filter(t => String(t.itemId) === sid).reduce((a, t) => a + (t.quantity || 0), 0);
        const openQ = Math.max((it.currentBalance || 0) + sQ - pQ, 0);
        return s + openQ * (it.costPrice || it.purchasePrice || 0);
      }, 0);

    const cfPurch  = sumTxnAmt(pTxns, cfIds);
    const mnPurch  = sumTxnAmt(pTxns, mnIds);
    const cfSale   = sumTxnAmt(sTxns, cfIds);
    const mnSale   = sumTxnAmt(sTxns, mnIds);
    const cfOpen   = openVal(cfItems, pTxns, sTxns);
    const mnOpen   = openVal(mnItems, pTxns, sTxns);
    const cfClose  = stockVal(cfItems);
    const mnClose  = stockVal(mnItems);

    const mk5 = (cf, mn) => ({ cattleFeeds: f2(cf), mineralSales: f2(mn), total: f2(cf + mn) });

    const section5 = {
      purchasedThisMonth: mk5(cfPurch, mnPurch),
      openingStock:       mk5(cfOpen,  mnOpen),
      salesThisMonth:     mk5(cfSale,  mnSale),
      closingStock:       mk5(cfClose, mnClose),
    };

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 6 — Monthly Balance
    // ════════════════════════════════════════════════════════════════════════

    // Helper — sum entries by ledger type(s) on a given side
    const sumV = (vchs, types, side) => f2(sumByType(vchs, types, side));

    // ── Current month financials ──────────────────────────────────────────
    // Other Sales Income (Row 17): Trade Income + Miscellaneous Income (credit)
    const otherIncNow  = sumV(vouchers,   INCOME_TYPES,  'credit');
    // Trade Expense (Row 19): all expense types (debit) excluding salary
    const tradeExpNow  = sumV(vouchers,   ['Trade Expenses', 'Contingencies', 'Expense'], 'debit');
    // Salary & Allowances (Row 20): Establishment Charges (debit)
    const salaryNow    = sumV(vouchers,   SALARY_TYPES,  'debit');
    // Other Expenses (Row 21): Miscellaneous Expenses (debit)
    const otherExpNow  = sumV(vouchers,   ['Miscellaneous Expenses'], 'debit');

    // ── Last month financials ─────────────────────────────────────────────
    // For last month milk sales income, compute using last month collections + sales
    let lmLocQ = 0, lmLocA = 0, lmCredQ = 0, lmCredA = 0, lmSampQ = 0, lmSampA = 0;
    lmSalesDocs.forEach(s => {
      const q = s.litre || 0, a = s.amount || 0;
      if (s.saleMode === 'LOCAL')  { lmLocQ  += q; lmLocA  += a; }
      if (s.saleMode === 'CREDIT') { lmCredQ += q; lmCredA += a; }
      if (s.saleMode === 'SAMPLE') { lmSampQ += q; lmSampA += a; }
    });
    let lmUniA = 0;
    lmUnionSlips.forEach(u => { lmUniA += u.amount || 0; });

    let lmPurchAmt = 0;
    lmCollections.forEach(c => { lmPurchAmt += c.amount || 0; });

    const lmTotSalesA   = lmLocA + lmCredA + lmSampA + lmUniA;
    const lmMilkIncome  = f2(lmTotSalesA - lmPurchAmt);

    const otherIncLast  = sumV(lmVouchers, INCOME_TYPES,  'credit');
    const tradeExpLast  = sumV(lmVouchers, ['Trade Expenses', 'Contingencies', 'Expense'], 'debit');
    const salaryLast    = sumV(lmVouchers, SALARY_TYPES,  'debit');
    const otherExpLast  = sumV(lmVouchers, ['Miscellaneous Expenses'], 'debit');

    // ── Welfare Fund from PaymentRegister ─────────────────────────────────
    const wfNow  = f2(payRegs.reduce((s, r) => s + (r.totalWelfare || 0), 0));
    const wfLast = f2(lmPayRegs.reduce((s, r) => s + (r.totalWelfare || 0), 0));

    // ── Derived rows ──────────────────────────────────────────────────────
    // Row 18: Total Trade Income = Milk Sales Income (10.1) + Other Income (17)
    const ttNow  = f2(milkSalesIncome + otherIncNow);
    const ttLast = f2(lmMilkIncome    + otherIncLast);

    // Row 19.1: Trade Profit = Total Trade Income − Trade Expense
    const tpANow  = f2(ttNow  - tradeExpNow);
    const tpALast = f2(ttLast - tradeExpLast);
    const tpPNow  = ttNow  > 0 ? f2((tpANow  / ttNow)  * 100) : 0;
    const tpPLast = ttLast > 0 ? f2((tpALast / ttLast) * 100) : 0;

    // Row 22: Net Profit = Trade Profit − Salary − Other Expenses
    const npNow  = f2(tpANow  - salaryNow  - otherExpNow);
    const npLast = f2(tpALast - salaryLast - otherExpLast);

    const mk3 = (l, d) => ({ lastMonth: l, duringMonth: d, total: f2(l + d) });

    const section6 = {
      otherSalesIncome: mk3(otherIncLast, otherIncNow),
      totalTradeIncome: mk3(ttLast,       ttNow),
      tradeExpense:     mk3(tradeExpLast, tradeExpNow),
      tradeProfitAmt:   mk3(tpALast,     tpANow),
      tradeProfitPct:   { lastMonth: tpPLast, duringMonth: tpPNow, total: 0 },
      salaryAllowances: mk3(salaryLast,   salaryNow),
      otherExpenses:    mk3(otherExpLast, otherExpNow),
      netProfit:        mk3(npLast,       npNow),
      welfareFund:      mk3(wfLast,       wfNow),
      welfareFundPaid:  mk3(0, 0),           // manual
      welfareFundDate:  { lastMonth: '', duringMonth: '', total: '' }, // manual
    };

    // ════════════════════════════════════════════════════════════════════════
    // Merge: computed as base, saved manual values override (but don't override
    // with saved zeros — user must have actively cleared those)
    // ════════════════════════════════════════════════════════════════════════
    const deepMerge = (base, override) => {
      if (!override || typeof override !== 'object') return base;
      const result = { ...base };
      Object.keys(override).forEach(k => {
        const ov = override[k];
        if (ov !== null && typeof ov === 'object' && !Array.isArray(ov)) {
          result[k] = deepMerge(base[k] || {}, ov);
        } else if (ov !== undefined && ov !== null && ov !== '' && ov !== 0) {
          // Only override with non-zero non-empty saved values
          result[k] = ov;
        }
      });
      return result;
    };

    const computed = { section1, section2, section3, section4, section5, section6 };
    const merged   = saved
      ? {
          section1: deepMerge(section1, saved.section1),
          section2: deepMerge(section2, saved.section2),
          section3: deepMerge(section3, saved.section3),
          section4: deepMerge(section4, saved.section4),
          section5: deepMerge(section5, saved.section5),
          section6: deepMerge(section6, saved.section6),
        }
      : computed;

    res.json({
      success: true,
      data: {
        _id:         saved?._id  || null,
        month:       m,
        year:        y,
        reportDate:  saved?.reportDate  || '',
        societyName: saved?.societyName || '',
        ...merged,
        section7: saved?.section7 || {},
        section8: saved?.section8 || {},
      },
    });

  } catch (err) {
    console.error('DDD MIS Report error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed' });
  }
};

// ── POST /api/reports/ddd-mis-report ─────────────────────────────────────────
export const saveDDDMISReport = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { month, year, ...rest } = req.body;
    if (!month || !year)
      return res.status(400).json({ success: false, message: 'month and year are required' });

    const doc = await DairyMISReport.findOneAndUpdate(
      { companyId, month: Number(month), year: Number(year) },
      { companyId, month: Number(month), year: Number(year), ...rest },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Save DDD MIS error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /api/reports/ddd-mis-report/:id ──────────────────────────────────────
export const updateDDDMISReport = async (req, res) => {
  try {
    const doc = await DairyMISReport.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Update DDD MIS error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
