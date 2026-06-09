import mongoose from 'mongoose';
import PaymentRegister from '../models/PaymentRegister.js';
import MilkCollection from '../models/MilkCollection.js';
import FarmerPayment from '../models/FarmerPayment.js';
import ProducerPayment from '../models/ProducerPayment.js';
import Advance from '../models/Advance.js';
import Farmer from '../models/Farmer.js';
import ProducerOpening from '../models/ProducerOpening.js';
import ProducerReceipt from '../models/ProducerReceipt.js';
import Sales from '../models/Sales.js';
import IndividualDeductionEarning from '../models/IndividualDeductionEarning.js';
import PeriodicalRule from '../models/PeriodicalRule.js';
import { purgeFarmerPaymentSideEffects } from './paymentController.js';
import { saveWithUniqueNumber } from '../models/Counter.js';
import { createRecoveryVoucher, createProducerDuesPaymentVoucher } from '../utils/accountingHelper.js';

// ±2-day tolerance for cycle date matching
function cycleRange(dateStr) {
  const mid = new Date(dateStr);
  return { $gte: new Date(mid - 2*86400000), $lte: new Date(mid.getTime() + 2*86400000) };
}

// ─── GET all registers (paginated, date filter) ───────────────────────────────
export const getPaymentRegisters = async (req, res) => {
  try {
    const { fromDate, toDate, status, registerType, page = 1, limit = 20 } = req.query;
    const companyId = req.companyId;

    const filter = { companyId };
    if (fromDate || toDate) {
      filter.fromDate = {};
      if (fromDate) filter.fromDate.$gte = new Date(fromDate);
      if (toDate)   filter.fromDate.$lte = new Date(toDate);
    }
    if (status)       filter.status       = status;
    if (registerType) filter.registerType = registerType;

    const total = await PaymentRegister.countDocuments(filter);
    // For Ledger type, include entries so history page can render them
    const selectFields = registerType === 'Ledger' ? '' : '-entries';
    const registers = await PaymentRegister.find(filter)
      .select(selectFields)
      .sort({ fromDate: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ success: true, total, data: registers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET saved cycle date ranges (for date picker exclusion) ─────────────────
export const getLockedCycleRanges = async (req, res) => {
  try {
    const companyId = req.companyId;
    const cycles = await PaymentRegister.find({
      companyId,
      status: { $in: ['Saved', 'Printed'] },
    }).select('fromDate toDate -_id').lean();
    res.json({ success: true, data: cycles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET single register with full entries ────────────────────────────────────
export const getPaymentRegister = async (req, res) => {
  try {
    const reg = await PaymentRegister.findOne({
      _id: req.params.id,
      companyId: req.companyId,
    });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GENERATE entries from milk collection data ───────────────────────────────
export const generatePaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // 1. Get all active farmers
    const farmers = await Farmer.find({ companyId, status: 'Active' })
      .select('farmerNumber personalDetails bankDetails collectionCenter')
      .populate('collectionCenter', 'centerName')
      .lean();

    const entries = [];

    for (const farmer of farmers) {
      // 2. Aggregate milk collections for this period
      const milkAgg = await MilkCollection.aggregate([
        {
          $match: {
            farmer: farmer._id,
            companyId,
            date: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            totalQty:    { $sum: '$qty' },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      const milkData = milkAgg[0] || { totalQty: 0, totalAmount: 0 };

      // Skip farmers with no milk this period
      if (milkData.totalQty === 0 && milkData.totalAmount === 0) continue;

      // 3. Previous balance — unpaid/partial farmer payments
      const prevAgg = await FarmerPayment.aggregate([
        {
          $match: {
            farmerId: farmer._id,
            companyId,
            status: { $in: ['Pending', 'Partial'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$balanceAmount' } } },
      ]);
      const previousBalance = prevAgg[0]?.total || 0;

      entries.push({
        farmerId:        farmer._id,
        productId:       farmer.farmerNumber || '',
        productName:     farmer.personalDetails?.name || '',
        qty:             Math.round((milkData.totalQty || 0) * 100) / 100,
        milkValue:       Math.round((milkData.totalAmount || 0) * 100) / 100,
        previousBalance: Math.round(previousBalance * 100) / 100,
        welfare:         0,
        deductions:      0,
        center:          farmer.collectionCenter?.centerName || '',
      });
    }

    // Sort by productId
    entries.sort((a, b) => (a.productId || '').localeCompare(b.productId || ''));

    res.json({
      success: true,
      data: {
        fromDate: start,
        toDate:   end,
        entries,
        totalEntries: entries.length,
      },
    });
  } catch (err) {
    console.error('generatePaymentRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GENERATE Producer Payment Register entries ───────────────────────────────
export const generateProducerPaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // 1. Get all active farmers
    const farmers = await Farmer.find({ companyId, status: 'Active' })
      .select('farmerNumber personalDetails')
      .lean();

    // 2. ProducerOpening seed map (used as the base for CF / Cash / Loan opening)
    const openings = await ProducerOpening.find({ companyId }).lean();
    const openingMap = {};
    openings.forEach(o => {
      const fid = o.farmerId?.toString();
      if (fid) openingMap[fid] = o;
    });

    // 3. Date-based ledger opening for CF / Cash / Loan as of `start`.
    //    Each cycle's recoveries are FarmerPayment rows with paymentDate = cycle.toDate
    //    (and matching deduction types). The opening for the new cycle is therefore:
    //      ProducerOpening.<x>Advance + Σ(advances given before start) − Σ(recoveries before start)
    //    Six bulk aggregations (3 categories × 2 directions) — no per-farmer N+1.

    const sumByFarmer = (rows) => {
      const m = {};
      rows.forEach(r => {
        const fid = r._id?.toString();
        if (!fid) return;
        m[fid] = (m[fid] || 0) + (r.total || 0);
      });
      return m;
    };

    // CF advances given — two sources, matching getCFAdvanceSummary / getFarmerOutstandingByType:
    //   (a) Non-cash credit sales of cattle feed items to farmers (cash sales excluded:
    //       farmer paid at point of sale so no advance is created)
    //   (b) Advance records with advanceCategory='CF Advance' (direct cash CF disbursements)
    // Both are counted up to cycle end so the column shows the full outstanding before
    // this cycle's recovery deduction is applied.
    const priorCFCreditSales = sumByFarmer(await Sales.aggregate([
      {
        $match: {
          companyId,
          customerType: 'Farmer',
          paymentMode:  { $ne: 'Cash' },
          billDate:     { $lte: end },
        },
      },
      { $group: { _id: '$customerId', total: { $sum: '$grandTotal' } } },
    ]));
    const priorCFCreditAdvances = sumByFarmer(await Advance.aggregate([
      {
        $match: {
          companyId,
          advanceCategory: 'CF Advance',
          status:          { $ne: 'Cancelled' },
          advanceDate:     { $lte: end },
        },
      },
      { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } },
    ]));
    const priorCFCredits = {};
    new Set([...Object.keys(priorCFCreditSales), ...Object.keys(priorCFCreditAdvances)])
      .forEach(fid => { priorCFCredits[fid] = (priorCFCreditSales[fid] || 0) + (priorCFCreditAdvances[fid] || 0); });

    // CF recoveries (FarmerPayment CF deductions) whose cycle ends before start.
    // Use paymentPeriod.toDate (which cycle the payment belongs to), NOT paymentDate
    // (when the entry was recorded) — a payment entered after cycle end (e.g. cycle
    // ended May 15 but entry made May 20) must still count as a prior-cycle recovery.
    const priorCFRecoveries = sumByFarmer(await FarmerPayment.aggregate([
      {
        $match: {
          companyId,
          status:            { $ne: 'Cancelled' },
          'deductions.type': { $in: ['CF Advance', 'Cattle Feed', 'CF Recovery'] },
          $or: [
            { 'paymentPeriod.toDate': { $lt: start } },
            { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
            { 'paymentPeriod.toDate': null,               paymentDate: { $lt: start } },
          ],
        },
      },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: ['CF Advance', 'Cattle Feed', 'CF Recovery'] } } },
      { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } },
    ]));

    // ProducerReceipt CF Advance receipts up to cycle end (also reduces outstanding)
    const priorCFReceipts = sumByFarmer(await ProducerReceipt.aggregate([
      {
        $match: {
          companyId,
          receiptType: 'CF Advance',
          status:      { $ne: 'Cancelled' },
          receiptDate: { $lte: end },
        },
      },
      { $group: { _id: '$farmerId', total: { $sum: '$amount' } } },
    ]));

    // Cash advances disbursed up to cycle end
    const priorCashCredits = sumByFarmer(await Advance.aggregate([
      {
        $match: {
          companyId,
          advanceCategory: 'Cash Advance',
          status:          { $ne: 'Cancelled' },
          advanceDate:     { $lte: end },
        },
      },
      { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } },
    ]));

    // Cash recoveries whose cycle ends before start (same paymentPeriod fix as CF)
    const priorCashRecoveries = sumByFarmer(await FarmerPayment.aggregate([
      {
        $match: {
          companyId,
          status:            { $ne: 'Cancelled' },
          'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] },
          $or: [
            { 'paymentPeriod.toDate': { $lt: start } },
            { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
            { 'paymentPeriod.toDate': null,               paymentDate: { $lt: start } },
          ],
        },
      },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: ['Cash Advance', 'Cash Recovery'] } } },
      { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } },
    ]));

    // Loan advances disbursed up to cycle end
    const priorLoanCredits = sumByFarmer(await Advance.aggregate([
      {
        $match: {
          companyId,
          advanceCategory: 'Loan Advance',
          status:          { $ne: 'Cancelled' },
          advanceDate:     { $lte: end },
        },
      },
      { $group: { _id: '$farmerId', total: { $sum: '$advanceAmount' } } },
    ]));

    // Loan recoveries whose cycle ends before start (same paymentPeriod fix as CF)
    const priorLoanRecoveries = sumByFarmer(await FarmerPayment.aggregate([
      {
        $match: {
          companyId,
          status:            { $ne: 'Cancelled' },
          'deductions.type': { $in: ['Loan Advance', 'Loan Recovery', 'Loan EMI'] },
          $or: [
            { 'paymentPeriod.toDate': { $lt: start } },
            { 'paymentPeriod.toDate': { $exists: false }, paymentDate: { $lt: start } },
            { 'paymentPeriod.toDate': null,               paymentDate: { $lt: start } },
          ],
        },
      },
      { $unwind: '$deductions' },
      { $match: { 'deductions.type': { $in: ['Loan Advance', 'Loan Recovery', 'Loan EMI'] } } },
      { $group: { _id: '$farmerId', total: { $sum: '$deductions.amount' } } },
    ]));

    // hasLedgerHistory = true if there is ANY prior Ledger register, used purely
    // to flag rows for the frontend so the CF Advance summary override is bypassed.
    const lastRegister = await PaymentRegister.findOne({
      companyId,
      registerType: 'Ledger',
      toDate:       { $lt: start },
    }).select('_id').lean();
    const hasLedgerHistory = !!lastRegister;

    // 4c. Two aggregates for previous balance:
    //   (i)  Pending/Partial payments → balanceAmount still owed (0 after bank transfer applies)
    //   (ii) ANY prior-cycle payment (any status) → tells us it's NOT the first cycle
    //        so we use 0 (fully paid) instead of dueAmount when cycle 1 is already Paid.
    // Previous-cycle window: paymentPeriod.toDate is stored at end-of-day on
    // the cycle's last date, while `start` is the new cycle's midnight. Using
    // `$lt: start` lets through any payment whose toDate sits in the last
    // millisecond before midnight (legitimate prior cycles), but also misses
    // payments stored exactly at the prev-cycle's UTC end-of-day. Switch to
    // `$lte: prevCycleEnd` (start − 1ms) so every prior-cycle payment is
    // correctly counted as "previous".
    const prevCycleEnd = new Date(start.getTime() - 1);

    const [pendingPayAgg, anyPriorAgg] = await Promise.all([
      FarmerPayment.aggregate([
        {
          $match: {
            companyId,
            status:                 { $in: ['Pending', 'Partial'] },
            'paymentPeriod.toDate': { $lte: prevCycleEnd },
          },
        },
        { $group: { _id: '$farmerId', total: { $sum: '$balanceAmount' } } },
      ]),
      FarmerPayment.aggregate([
        {
          $match: {
            companyId,
            status:                 { $ne: 'Cancelled' },
            'paymentPeriod.toDate': { $lte: prevCycleEnd },
          },
        },
        { $group: { _id: '$farmerId', count: { $sum: 1 } } },
      ]),
    ]);

    const pendingBalMap = {};
    pendingPayAgg.forEach(p => {
      pendingBalMap[p._id?.toString()] = p.total || 0;
    });

    // Set of farmerIds who have ANY prior-cycle payment (not just pending)
    const hasPriorPaymentSet = new Set(anyPriorAgg.map(p => p._id?.toString()));

    // 4. Welfare amount — from active PeriodicalRule (DEDUCTIONS + FIXED_AMOUNT)
    const welfareRule = await PeriodicalRule.findOne({
      companyId,
      component: 'DEDUCTIONS',
      basedOn:   'FIXED_AMOUNT',
      active:    true,
    }).lean();
    const welfareFixed = welfareRule?.fixedRate || 0;

    // Welfare is charged ONCE per farmer per calendar month, in the first
    // cycle of that month in which the farmer poured milk. Build a set of
    // farmers who already had welfare deducted in an EARLIER cycle of the
    // SAME month — those are skipped. The rule resets at month start.
    let alreadyDeductedSet = new Set();
    if (welfareFixed > 0) {
      const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
      const [pmtHits, regs] = await Promise.all([
        FarmerPayment.find({
          companyId,
          status: { $ne: 'Cancelled' },
          'deductions.type': 'Welfare Recovery',
          'paymentPeriod.toDate': { $gte: monthStart, $lt: start },
        }).select('farmerId deductions').lean(),
        PaymentRegister.find({
          companyId,
          registerType: 'Ledger',
          fromDate: { $gte: monthStart, $lt: start },
        }).select('entries.farmerId entries.welfare').lean(),
      ]);
      pmtHits.forEach(p => {
        const has = (p.deductions || []).some(d => d.type === 'Welfare Recovery' && (d.amount || 0) > 0);
        if (has && p.farmerId) alreadyDeductedSet.add(p.farmerId.toString());
      });
      regs.forEach(r => {
        (r.entries || []).forEach(e => {
          if ((e.welfare || 0) > 0 && e.farmerId) alreadyDeductedSet.add(e.farmerId.toString());
        });
      });
    }

    const entries = [];

    for (const farmer of farmers) {
      // 5. Milk collections for period
      const milkAgg = await MilkCollection.aggregate([
        { $match: { farmer: farmer._id, companyId, date: { $gte: start, $lte: end } } },
        { $group: { _id: null, totalQty: { $sum: '$qty' }, totalAmount: { $sum: '$amount' } } },
      ]);
      const milkData = milkAgg[0] || { totalQty: 0, totalAmount: 0 };

      const fid     = farmer._id.toString();
      const opening = openingMap[fid]  || {};

      // 6. Previous balance:
      //    — True first cycle (no prior payments at all): ProducerOpening.dueAmount
      //    — Cycle 2+, payment still pending:  sum of balanceAmount (= netPay since paidAmount=0)
      //    — Cycle 2+, payment fully paid (bank transfer applied): 0
      const hasPriorPayment   = hasPriorPaymentSet.has(fid);
      const hasPendingHistory = pendingBalMap[fid] !== undefined;
      const previousBalance   = (!hasPriorPayment && !hasPendingHistory)
        ? (opening.dueAmount  || 0)          // true first cycle → use opening due
        : (pendingBalMap[fid] || 0);         // cycle 2+: pending balance or 0 if fully paid

      // 7. CF / Cash / Loan opening balances are computed from the date-based
      //    ledger as of (start - 1):  base opening + Σ credits − Σ debits before
      //    `start`. Each cycle's saved recoveries are FarmerPayment rows dated
      //    on the cycle's toDate, so they automatically carry forward into the
      //    next cycle's opening through these aggregations.
      const cfAdv = Math.max(0,
        (opening.cfAdvance  || 0)
        + (priorCFCredits[fid]    || 0)
        - (priorCFRecoveries[fid] || 0)
        - (priorCFReceipts[fid]   || 0)
      );
      const cashAdv = Math.max(0,
        (opening.cashAdvance || 0)
        + (priorCashCredits[fid]    || 0)
        - (priorCashRecoveries[fid] || 0)
      );
      const loanAdv = Math.max(0,
        (opening.loanAdvance || 0)
        + (priorLoanCredits[fid]    || 0)
        - (priorLoanRecoveries[fid] || 0)
      );

      // Skip farmers who have nothing this cycle AND no carried-forward balance.
      // Include them when there's milk this cycle, OR any of the deduction
      // openings (CF / Cash / Loan) is non-zero, OR a previous balance exists.
      const hasMilk = (milkData.totalQty || 0) > 0 || (milkData.totalAmount || 0) > 0;
      const hasCarry = cfAdv > 0 || cashAdv > 0 || loanAdv > 0 || (previousBalance || 0) !== 0;
      if (!hasMilk && !hasCarry) continue;

      // Flag rows that have any prior ledger activity so the frontend's CF
      // Advance summary override is bypassed (cycle 2+ trusts this carry value).
      const hasPriorActivity =
        hasLedgerHistory ||
        priorCFCredits[fid]    || priorCFRecoveries[fid]   || priorCFReceipts[fid] ||
        priorCashCredits[fid]  || priorCashRecoveries[fid] ||
        priorLoanCredits[fid]  || priorLoanRecoveries[fid];

      // 8. Welfare — deducted once per calendar month, but ONLY if the farmer
      //    poured milk this cycle. Farmers included solely because they carry an
      //    outstanding CF/Cash/Loan advance (hasMilk = false) must not be charged
      //    welfare — they are present only for advance recovery, not for payment.
      const welfare = (welfareFixed > 0 && hasMilk && !alreadyDeductedSet.has(fid)) ? welfareFixed : 0;

      const milkValue  = Math.round((milkData.totalAmount || 0) * 100) / 100;
      // netPayable preview: cfAdv/loanAdv/cashAdv are opening balance columns (not deducted here —
      // user enters cfRec/cashRec/loanRec recovery amounts in the UI which become the actual deductions)
      const netPayable = milkValue - welfare + previousBalance;

      entries.push({
        farmerId:        farmer._id,
        productId:       farmer.farmerNumber || '',
        productName:     farmer.personalDetails?.name || '',
        qty:             Math.round((milkData.totalQty  || 0) * 100) / 100,
        milkValue,
        previousBalance: Math.round(previousBalance     * 100) / 100,
        welfare:         Math.round(welfare             * 100) / 100,
        // Field names match what toRow() in frontend expects:
        // cfRec → maps to cfAdv column (opening CF advance balance)
        // cashPocket → maps to cashAdv column
        // loanAdv → maps to loanAdv column
        cfRec:           Math.round(cfAdv               * 100) / 100,
        cashPocket:      Math.round(cashAdv             * 100) / 100,
        loanAdv:         Math.round(loanAdv             * 100) / 100,
        netPay:          Math.round(netPayable          * 100) / 100,
        payStatus:       netPayable > 0 ? 'Payable' : netPayable < 0 ? 'Receivable' : '',
        // cf/cash/loan are authoritative date-ledger carry values (lifetime
        // opening + prior credits − prior recoveries). Frontend uses this flag
        // to skip the live CF Advance summary override on cycle 2+.
        hasPriorRegister: !!hasPriorActivity,
      });
    }

    entries.sort((a, b) => (a.productId || '').localeCompare(b.productId || ''));

    res.json({
      success: true,
      data: { fromDate: start, toDate: end, entries, totalEntries: entries.length },
    });
  } catch (err) {
    console.error('generateProducerPaymentRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE / SAVE register ───────────────────────────────────────────────────
// Upsert by {companyId, registerType, fromDate, toDate} so re-saves replace the
// existing log instead of inserting a duplicate row for the same cycle.
//
// Ledger entries: cfAdv/cashAdv/loanAdv must always equal the prior cycle's
// remaining balance (cfAdv − cfRec from the most recent prior Ledger register).
// We recompute these on every save so a stale frontend payload can't write the
// wrong opening — the user only edits cfRec/cashRec/loanRec; the openings are
// derived authoritatively here.
export const createPaymentRegister = async (req, res) => {
  try {
    const { fromDate, toDate, entries, remarks, status, registerType } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const fd = new Date(fromDate);
    const td = new Date(toDate);
    const type = registerType || 'Creditor';

    // Match an existing register for the same period (±2 day window for IST/UTC drift).
    const fdLow  = new Date(fd); fdLow.setDate(fdLow.getDate()  - 2);
    const fdHigh = new Date(fd); fdHigh.setDate(fdHigh.getDate() + 2);
    const tdLow  = new Date(td); tdLow.setDate(tdLow.getDate()  - 2);
    const tdHigh = new Date(td); tdHigh.setDate(tdHigh.getDate() + 2);

    let normalizedEntries = entries || [];

    // For Ledger registers, force cf/cash/loan opening to the carry from the
    // most recent prior Ledger register, ignoring whatever the frontend sent.
    if (type === 'Ledger' && normalizedEntries.length > 0) {
      const priorReg = await PaymentRegister.findOne({
        companyId,
        registerType: 'Ledger',
        toDate: { $lt: fd },
        fromDate: { $ne: fd },
      }).sort({ toDate: -1 }).lean();

      const carryMap = {};
      if (priorReg?.entries?.length > 0) {
        priorReg.entries.forEach(e => {
          const fid = e.farmerId?.toString();
          if (!fid) return;
          carryMap[fid] = {
            cfAdv:   Math.max(0, (e.cfAdv   || 0) - (e.cfRec   || 0)),
            cashAdv: Math.max(0, (e.cashAdv || 0) - (e.cashRec || 0)),
            loanAdv: Math.max(0, (e.loanAdv || 0) - (e.loanRec || 0)),
          };
        });
      }
      const isFirstCycle = !priorReg;
      normalizedEntries = normalizedEntries.map(e => {
        const fid = e.farmerId?.toString();
        const carry = fid ? carryMap[fid] : null;
        if (carry) {
          return { ...e, cfAdv: carry.cfAdv, cashAdv: carry.cashAdv, loanAdv: carry.loanAdv };
        }
        if (isFirstCycle) {
          // No prior register at all — keep whatever the frontend sent (seeded
          // from ProducerOpening / live CF Advance summary on the very first cycle).
          return e;
        }
        // Cycle 2+ but this farmer wasn't in the prior register → no carry.
        return { ...e, cfAdv: 0, cashAdv: 0, loanAdv: 0 };
      });
    }

    let reg = await PaymentRegister.findOne({
      companyId,
      registerType: type,
      fromDate: { $gte: fdLow, $lte: fdHigh },
      toDate:   { $gte: tdLow, $lte: tdHigh },
    });

    if (reg) {
      reg.fromDate = fd;
      reg.toDate   = td;
      reg.entries  = normalizedEntries;
      if (remarks !== undefined) reg.remarks = remarks;
      reg.status   = status || 'Saved';
      await reg.save();
      return res.json({ success: true, data: reg, replaced: true });
    }

    reg = new PaymentRegister({
      companyId,
      fromDate:     fd,
      toDate:       td,
      registerType: type,
      entries:      normalizedEntries,
      remarks,
      status:       status || 'Saved',
      createdBy:    req.user?._id,
    });

    await reg.save();
    res.status(201).json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE register ──────────────────────────────────────────────────────────
export const updatePaymentRegister = async (req, res) => {
  try {
    const { entries, remarks, status, fromDate, toDate } = req.body;
    const reg = await PaymentRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });

    if (entries  !== undefined) reg.entries  = entries;
    if (remarks  !== undefined) reg.remarks  = remarks;
    if (status   !== undefined) reg.status   = status;
    if (fromDate !== undefined) reg.fromDate = new Date(fromDate);
    if (toDate   !== undefined) reg.toDate   = new Date(toDate);

    await reg.save();
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE register ──────────────────────────────────────────────────────────
export const deletePaymentRegister = async (req, res) => {
  try {
    const reg = await PaymentRegister.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REVERSE register — fully unwinds every FarmerPayment for the period ─────
// Per the Producers Dues spec: deleting the saved cycle from Ledger Payment
// History must (1) delete every recovery transaction in CF / Cash / Loan
// modules, (2) delete the auto-posted Day Book / recovery vouchers,
// (3) delete the mirrored ProducerPayment rows, (4) restore ProducerOpening
// leftovers, and (5) delete the register log itself — leaving the underlying
// Payment Register Detailed entries free to be re-saved.
export const reversePaymentRegister = async (req, res) => {
  try {
    const reg = await PaymentRegister.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });

    const from = new Date(reg.fromDate);
    const to   = new Date(reg.toDate);

    // ±2 day tolerance for IST/UTC offset between saved period and stored period
    const fromLow  = new Date(from); fromLow.setDate(fromLow.getDate() - 2);
    const fromHigh = new Date(from); fromHigh.setDate(fromHigh.getDate() + 2);
    const toLow    = new Date(to);   toLow.setDate(toLow.getDate() - 2);
    const toHigh   = new Date(to);   toHigh.setDate(toHigh.getDate() + 2);

    // Pull every FarmerPayment row that belongs to this cycle (any source / status)
    const payments = await FarmerPayment.find({
      companyId:                req.companyId,
      'paymentPeriod.fromDate': { $gte: fromLow, $lte: fromHigh },
      'paymentPeriod.toDate':   { $gte: toLow,   $lte: toHigh   },
      status:                   { $ne: 'Cancelled' },
    });

    let purged = 0;
    for (const pmt of payments) {
      try {
        await purgeFarmerPaymentSideEffects(pmt);
        await FarmerPayment.deleteOne({ _id: pmt._id });
        purged++;
      } catch (perPmtErr) {
        console.error(`Failed to purge FarmerPayment ${pmt._id}:`, perPmtErr.message);
      }
    }

    // Finally, delete the register log so the cycle re-opens in Detailed Ledger
    await reg.deleteOne();

    res.json({
      success: true,
      message: `Register reversed. ${purged} payment(s) deleted with full ledger / voucher rollback.`,
      data: {
        fromDate: reg.fromDate,
        toDate:   reg.toDate,
        purgedCount: purged,
      },
    });
  } catch (err) {
    console.error('reversePaymentRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Producers register for a period (latest saved) ───────────────────────
export const getProducersForPeriod = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const start = new Date(fromDate);
    const end   = new Date(toDate); end.setHours(23, 59, 59, 999);

    // Find the most recently saved Producers register whose period overlaps the requested range
    const reg = await PaymentRegister.findOne({
      companyId,
      registerType: 'Producers',
      fromDate: { $lte: end },
      toDate:   { $gte: start },
    }).sort({ createdAt: -1 });

    if (!reg) return res.json({ success: true, data: null });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET latest Producers register (no date filter) ───────────────────────────
export const getLatestProducers = async (req, res) => {
  try {
    const companyId = req.companyId;
    const reg = await PaymentRegister.findOne({
      companyId,
      registerType: 'Producers',
    }).sort({ createdAt: -1 });

    if (!reg) return res.json({ success: true, data: null });
    res.json({ success: true, data: reg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET milk value for a single farmer from MilkCollection ──────────────────
export const getFarmerMilkValue = async (req, res) => {
  try {
    const { farmerId, fromDate, toDate } = req.query;
    const companyId = req.companyId;

    if (!farmerId || !fromDate || !toDate)
      return res.status(400).json({ success: false, message: 'farmerId, fromDate, toDate required' });

    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const [milkAgg] = await MilkCollection.aggregate([
      { $match: { farmer: new mongoose.Types.ObjectId(farmerId), companyId, date: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalQty: { $sum: '$qty' }, totalAmount: { $sum: '$amount' } } },
    ]);

    res.json({ success: true, data: milkAgg || { totalQty: 0, totalAmount: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── APPLY payment for a single entry in a register ───────────────────────────
export const applyEntryPayment = async (req, res) => {
  try {
    const { registerId, entryId } = req.params;
    const { paymentMode, paidAmount, cfRec, cashRec, loanRec, otherDed } = req.body;
    const companyId = req.companyId;

    const reg = await PaymentRegister.findOne({ _id: registerId, companyId });
    if (!reg) return res.status(404).json({ success: false, message: 'Register not found' });

    const entry = reg.entries.id(entryId);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (entry.paid) return res.status(400).json({ success: false, message: 'Already paid' });

    const mode      = paymentMode || 'Cash';
    const netAmount = paidAmount  || entry.netPay;

    // Build deductions array for FarmerPayment
    const deductions = [];
    if ((entry.welfare || 0)    > 0) deductions.push({ type: 'Welfare Recovery', amount: entry.welfare,    description: 'Welfare' });
    if ((entry.cfRec   || 0)    > 0) deductions.push({ type: 'CF Advance',       amount: entry.cfRec,      description: 'CF Advance' });
    if ((cfRec         || 0)    > 0) deductions.push({ type: 'CF Recovery',       amount: cfRec,            description: 'CF Recovery' });
    if ((entry.loanAdv || 0)    > 0) deductions.push({ type: 'Loan Advance',     amount: entry.loanAdv,    description: 'Loan Advance' });
    if ((loanRec       || 0)    > 0) deductions.push({ type: 'Loan Recovery',     amount: loanRec,          description: 'Loan Recovery' });
    if ((entry.cashPocket || 0) > 0) deductions.push({ type: 'Cash Advance',     amount: entry.cashPocket, description: 'Cash Advance' });
    if ((cashRec       || 0)    > 0) deductions.push({ type: 'Cash Recovery',     amount: cashRec,          description: 'Cash Recovery' });
    if ((otherDed      || 0)    > 0) deductions.push({ type: 'Other',             amount: otherDed,         description: 'Other' });

    // Create FarmerPayment.
    // Bank Transfer mode → queue as Pending so retrieveBalances picks it up
    // (filter requires paymentSource='BankTransfer' AND status in Pending/Partial).
    // Cash/Cheque/Direct → mark Paid immediately.
    const isBankMode = mode === 'Bank Transfer' || mode === 'Bank';
    const fp = await saveWithUniqueNumber({
      Model:       FarmerPayment,
      companyId,
      prefix:      'PAY',
      numberField: 'paymentNumber',
      build: () => new FarmerPayment({
        companyId,
        farmerId:        entry.farmerId,
        farmerName:      entry.productName,
        paymentDate:     reg.toDate || new Date(),
        paymentPeriod:   { fromDate: reg.fromDate, toDate: reg.toDate, periodType: 'Custom' },
        milkAmount:      entry.milkValue,
        previousBalance: entry.previousBalance,
        deductions,
        netPayable:      entry.netPay,
        paidAmount:      isBankMode ? 0 : netAmount,
        balanceAmount:   isBankMode ? entry.netPay : 0,
        paymentMode:     mode,
        paymentSource:   isBankMode ? 'BankTransfer' : 'PaymentRegister',
        status:          isBankMode ? 'Pending' : 'Paid',
        remarks:         `Ledger — ${reg.fromDate.toLocaleDateString('en-IN')}–${reg.toDate.toLocaleDateString('en-IN')}`,
      }),
    });

    // Mark entry paid
    entry.paid            = true;
    entry.paymentMode     = mode;
    entry.paidAmount      = netAmount;
    entry.farmerPaymentId = fp._id;
    await reg.save();

    res.json({ success: true, data: { farmerPaymentId: fp._id, entry } });
  } catch (err) {
    console.error('applyEntryPayment error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SAVE AND POST Producers register (POST /payment-register/producers-post) ─
// Saves the register + auto-posts deductions and payment vouchers to ledgers.
export const saveAndPostProducersRegister = async (req, res) => {
  try {
    const { fromDate, toDate, entries, registerId } = req.body;
    const companyId = req.companyId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const fd = new Date(fromDate);
    const td = new Date(toDate);

    // ── Priority-based deduction cap ───────────────────────────────────────────
    // Order: Welfare (full) → CF Recovery (full) → Cash Advance (full) → Loan Advance (remaining)
    const cappedEntries = (entries || []).map(e => {
      let remaining = Math.max(0, (e.milkValue || 0) + (e.previousBalance || 0));

      const welfareActual    = Math.min(e.welfare    || 0, remaining); remaining -= welfareActual;
      const cfRecActual      = Math.min(e.cfRec      || 0, remaining); remaining -= cfRecActual;
      const cashPocketActual = Math.min(e.cashPocket || 0, remaining); remaining -= cashPocketActual;
      const loanAdvActual    = Math.min(e.loanAdv    || 0, remaining); remaining -= loanAdvActual;

      return {
        ...e,
        welfare:    Math.round(welfareActual    * 100) / 100,
        cfRec:      Math.round(cfRecActual      * 100) / 100,
        cashPocket: Math.round(cashPocketActual * 100) / 100,
        loanAdv:    Math.round(loanAdvActual    * 100) / 100,
        netPay:     Math.round(remaining        * 100) / 100,
      };
    });

    // ── Find existing register by registerId or date range match ───────────────
    const fdLow  = new Date(fd); fdLow.setDate(fdLow.getDate()   - 2);
    const fdHigh = new Date(fd); fdHigh.setDate(fdHigh.getDate() + 2);
    const tdLow  = new Date(td); tdLow.setDate(tdLow.getDate()   - 2);
    const tdHigh = new Date(td); tdHigh.setDate(tdHigh.getDate() + 2);

    let reg = null;
    if (registerId) {
      reg = await PaymentRegister.findOne({ _id: registerId, companyId });
    }
    if (!reg) {
      reg = await PaymentRegister.findOne({
        companyId,
        registerType: 'Producers',
        fromDate: { $gte: fdLow, $lte: fdHigh },
        toDate:   { $gte: tdLow, $lte: tdHigh },
      });
    }

    // ── Purge old FarmerPayments if register was already auto-posted ───────────
    if (reg?.autoPosted) {
      const oldPayments = await FarmerPayment.find({
        companyId,
        paymentSource: 'PaymentRegister',
        status:        { $ne: 'Cancelled' },
        'paymentPeriod.fromDate': { $gte: fdLow, $lte: fdHigh },
        'paymentPeriod.toDate':   { $gte: tdLow, $lte: tdHigh },
      });
      for (const p of oldPayments) {
        try {
          await purgeFarmerPaymentSideEffects(p);
          await FarmerPayment.deleteOne({ _id: p._id });
        } catch (err) {
          console.error(`purge FarmerPayment ${p._id}:`, err.message);
        }
      }
    }

    // ── Save the register ──────────────────────────────────────────────────────
    if (reg) {
      reg.fromDate   = fd;
      reg.toDate     = td;
      reg.entries    = cappedEntries;
      reg.status     = 'Saved';
      reg.autoPosted = false; // will be set true after successful posting
    } else {
      reg = new PaymentRegister({
        companyId,
        fromDate:     fd,
        toDate:       td,
        registerType: 'Producers',
        entries:      cappedEntries,
        status:       'Saved',
        createdBy:    req.user?._id,
      });
    }
    await reg.save();

    // ── Post each entry to ledgers ─────────────────────────────────────────────
    let postedCount = 0;
    const warnings  = [];
    const fdStr = fd.toLocaleDateString('en-IN');
    const tdStr = td.toLocaleDateString('en-IN');

    // Consolidated totals for single voucher posting on cycle's last date
    let totalWelfare = 0, totalCFRec = 0, totalCashAdv = 0, totalLoanAdv = 0, totalNetPay = 0;
    const narrationLines = [];

    for (const e of cappedEntries) {
      if (!e.farmerId) continue;
      const netPay = typeof e.netPay === 'number' ? e.netPay : (e.netPayable || 0);

      // Build deductions array in priority order
      const deductions = [];
      if ((e.welfare    || 0) > 0) deductions.push({ type: 'Welfare Recovery', amount: e.welfare,    description: 'Welfare' });
      if ((e.cfRec      || 0) > 0) deductions.push({ type: 'CF Advance',       amount: e.cfRec,      description: 'CF Recovery' });
      if ((e.cashPocket || 0) > 0) deductions.push({ type: 'Cash Advance',     amount: e.cashPocket, description: 'Cash Advance' });
      if ((e.loanAdv    || 0) > 0) deductions.push({ type: 'Loan Advance',     amount: e.loanAdv,    description: 'Loan Advance' });

      // Create individual FarmerPayment record for history / tracking
      try {
        await saveWithUniqueNumber({
          Model:       FarmerPayment,
          companyId,
          prefix:      'PAY',
          numberField: 'paymentNumber',
          build: () => new FarmerPayment({
            companyId,
            farmerId:        e.farmerId,
            farmerName:      e.productName      || '',
            paymentDate:     td,
            paymentPeriod:   { fromDate: fd, toDate: td, periodType: 'Custom' },
            milkAmount:      e.milkValue        || 0,
            previousBalance: e.previousBalance  || 0,
            deductions,
            netPayable:      netPay,
            paidAmount:      netPay > 0 ? netPay : 0,
            balanceAmount:   0,
            paymentMode:     'Cash',
            paymentSource:   'PaymentRegister',
            status:          netPay > 0 ? 'Paid' : 'Pending',
            remarks:         `Payment Register — ${fdStr}–${tdStr}`,
          }),
        });
      } catch (err) {
        warnings.push(`FarmerPayment failed for ${e.productName || e.farmerId}: ${err.message}`);
        continue;
      }

      // Accumulate consolidated totals
      totalWelfare  += (e.welfare    || 0);
      totalCFRec    += (e.cfRec      || 0);
      totalCashAdv  += (e.cashPocket || 0);
      totalLoanAdv  += (e.loanAdv    || 0);
      if (netPay > 0) totalNetPay += netPay;

      // Per-farmer narration detail
      const line = `${e.productId}|${e.productName}|Milk:₹${(e.milkValue||0).toFixed(2)}|Net:₹${(netPay||0).toFixed(2)}`
        + ((e.welfare    ||0) > 0 ? `|Welf:₹${e.welfare}`    : '')
        + ((e.cfRec      ||0) > 0 ? `|CF:₹${e.cfRec}`        : '')
        + ((e.cashPocket ||0) > 0 ? `|Cash:₹${e.cashPocket}` : '')
        + ((e.loanAdv    ||0) > 0 ? `|Loan:₹${e.loanAdv}`    : '');
      narrationLines.push(line);

      postedCount++;
    }

    // ── Consolidated narration: period + summary + per-farmer details ──────────
    const periodLabel  = `Payment Register (Producers) ${fdStr}–${tdStr} | ${postedCount} farmers`;
    const summaryLabel = `Welfare:₹${totalWelfare.toFixed(2)} CF:₹${totalCFRec.toFixed(2)} Cash:₹${totalCashAdv.toFixed(2)} Loan:₹${totalLoanAdv.toFixed(2)} NetPay:₹${totalNetPay.toFixed(2)}`;
    const detailNarration = `${periodLabel} | ${summaryLabel} | ${narrationLines.join('; ')}`;

    // ── Single consolidated recovery voucher on cycle's last date ─────────────
    // Dr PRODUCERS DUES / Cr Welfare + CF + Cash + Loan ledgers (all in one voucher)
    const consolidatedDeductions = [];
    if (totalWelfare > 0) consolidatedDeductions.push({ type: 'Welfare Recovery', amount: Math.round(totalWelfare * 100) / 100, description: 'Welfare' });
    if (totalCFRec   > 0) consolidatedDeductions.push({ type: 'CF Advance',       amount: Math.round(totalCFRec   * 100) / 100, description: 'CF Recovery' });
    if (totalCashAdv > 0) consolidatedDeductions.push({ type: 'Cash Advance',     amount: Math.round(totalCashAdv * 100) / 100, description: 'Cash Advance' });
    if (totalLoanAdv > 0) consolidatedDeductions.push({ type: 'Loan Advance',     amount: Math.round(totalLoanAdv * 100) / 100, description: 'Loan Advance' });

    if (consolidatedDeductions.length > 0) {
      try {
        // Zero ObjectId → no farmer-linked ledger found → falls back to PRODUCERS DUES ledger
        await createRecoveryVoucher({
          farmerId:      new mongoose.Types.ObjectId('000000000000000000000000'),
          companyId,
          paymentDate:   td,
          deductions:    consolidatedDeductions,
          paymentNumber: detailNarration,
          _id:           reg._id,
        }, null);
      } catch (err) {
        warnings.push(`Consolidated recovery voucher failed: ${err.message}`);
      }
    }

    // ── Single consolidated payment voucher on cycle's last date ──────────────
    // Dr PRODUCERS DUES / Cr Cash — total net payable across all farmers
    const consolidatedNetPay = Math.round(totalNetPay * 100) / 100;
    if (consolidatedNetPay > 0) {
      try {
        await createProducerDuesPaymentVoucher({
          amount:        consolidatedNetPay,
          paymentDate:   td,
          paymentMode:   'Cash',
          companyId,
          narration:     detailNarration,
          referenceType: 'PaymentRegister',
          referenceId:   reg._id,
          createdBy:     req.user?._id,
        }, null);
      } catch (err) {
        warnings.push(`Consolidated payment voucher failed: ${err.message}`);
      }
    }

    reg.autoPosted = true;
    await reg.save();

    res.json({ success: true, data: reg, postedCount, warnings });
  } catch (err) {
    console.error('saveAndPostProducersRegister error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET Producers history (GET /payment-register/producers-history) ──────────
export const getProducersHistory = async (req, res) => {
  try {
    const companyId = req.companyId;
    const registers = await PaymentRegister.find({
      companyId,
      registerType: 'Producers',
    }).select('-entries').sort({ fromDate: -1 }).limit(50);
    res.json({ success: true, data: registers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PAYMENT PAID REPORT ──────────────────────────────────────────────────────
// GET /payment-register/paid-report?fromDate=&toDate=
// Returns producer-wise summary: net payable, bank transfer, pay-to-producer, individual paid
export const getPaidReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const companyId = req.companyId;
    if (!fromDate || !toDate) return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });

    const fromRange = cycleRange(fromDate);
    const toRange   = cycleRange(toDate);

    // 1. Base list + net payable from saved register (Producers or Ledger type)
    const register = await PaymentRegister.findOne({
      companyId,
      registerType: { $in: ['Producers', 'Ledger'] },
      fromDate: fromRange,
      toDate:   toRange,
      status:   { $in: ['Saved', 'Printed'] },
    }).lean();

    // Build farmer map from register entries
    const farmerMap = {};
    if (register) {
      for (const e of register.entries) {
        const id = e.farmerId?.toString();
        if (!id) continue;
        farmerMap[id] = {
          farmerId:     id,
          producerId:   e.producerId   || e.productId   || '',
          producerName: e.producerName || e.productName || '',
          center:       e.center       || '',
          netPayable:   e.netPay       || 0,
          bankTransfer: 0,
          payToProducer: 0,
          individual:   0,
        };
      }
    }

    // 2. Bank Transfer amounts — FarmerPayment with paymentSource=BankTransfer, status=Paid
    const btPayments = await FarmerPayment.find({
      companyId,
      paymentSource: 'BankTransfer',
      status: 'Paid',
      'paymentPeriod.fromDate': fromRange,
      'paymentPeriod.toDate':   toRange,
    }).select('farmerId paidAmount farmerName').lean();
    for (const p of btPayments) {
      const id = p.farmerId?.toString();
      if (!id) continue;
      if (!farmerMap[id]) farmerMap[id] = { farmerId: id, producerId: '', producerName: p.farmerName || '', center: '', netPayable: 0, bankTransfer: 0, payToProducer: 0, individual: 0 };
      farmerMap[id].bankTransfer += (p.paidAmount || 0);
    }

    // 3. Pay to Producer (cash) — ProducerPayment
    const cashPayments = await ProducerPayment.find({
      companyId,
      status: 'Active',
      'processingPeriod.fromDate': fromRange,
      'processingPeriod.toDate':   toRange,
    }).select('farmerId amountPaid producerName producerNumber').lean();
    for (const p of cashPayments) {
      const id = p.farmerId?.toString();
      if (!id) continue;
      if (!farmerMap[id]) farmerMap[id] = { farmerId: id, producerId: p.producerNumber || '', producerName: p.producerName || '', center: '', netPayable: 0, bankTransfer: 0, payToProducer: 0, individual: 0 };
      farmerMap[id].payToProducer += (p.amountPaid || 0);
    }

    // 4. Individual payments — FarmerPayment with paymentSource not BankTransfer
    const indPayments = await FarmerPayment.find({
      companyId,
      paymentSource: { $in: ['Ledger', 'PaymentRegister'] },
      status: { $in: ['Paid', 'Partial'] },
      'paymentPeriod.fromDate': fromRange,
      'paymentPeriod.toDate':   toRange,
    }).select('farmerId paidAmount farmerName').lean();
    for (const p of indPayments) {
      const id = p.farmerId?.toString();
      if (!id) continue;
      if (!farmerMap[id]) farmerMap[id] = { farmerId: id, producerId: '', producerName: p.farmerName || '', center: '', netPayable: 0, bankTransfer: 0, payToProducer: 0, individual: 0 };
      farmerMap[id].individual += (p.paidAmount || 0);
    }

    const rows = Object.values(farmerMap).map((r, i) => ({
      ...r,
      slNo: i + 1,
      totalPaid: r.bankTransfer + r.payToProducer + r.individual,
      balance:   r.netPayable  - (r.bankTransfer + r.payToProducer + r.individual),
    }));

    res.json({ success: true, data: { rows, fromDate, toDate } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
