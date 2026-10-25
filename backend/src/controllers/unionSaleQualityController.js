import mongoose from 'mongoose';
import UnionSaleSettings from '../models/UnionSaleSettings.js';
import UnionSalesSlip from '../models/UnionSalesSlip.js';
import MilkCollection from '../models/MilkCollection.js';
import CollectionCenter from '../models/CollectionCenter.js';
import { TSRateCharge } from '../models/RateChart.js';

// ════════════════════════════════════════════════════════════════
//  Union Sale Quality Comparison + Union Sales Settings
//
//  Procurement (From Dairy) = Daily Collection List, per date + centre.
//  To Dairy                  = Union Sales slips (society-level), per date.
//  TS = FAT + SNF.  TS-based rate = TS × TS rate / 100.
//  Average Rate:
//    From Dairy — TS enabled & date ≥ its From Date → TS rate from Machine
//                 Configuration (TSRateCharge); otherwise Σ amount / Σ qty.
//    To Dairy   — TS enabled & date ≥ its From Date → the manually entered
//                 To Dairy TS rate; otherwise the slips' Σ amount / Σ qty.
// ════════════════════════════════════════════════════════════════

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const dayEnd = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
const ymd = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : '');
const r2 = (n) => Number((Number(n) || 0).toFixed(2));

// Period in force on a YYYY-MM-DD day (fromDate ≤ day ≤ toDate; no toDate = open)
const periodOn = (periods, day) => periods
  .filter(p => ymd(p.fromDate) <= day && (!p.toDate || ymd(p.toDate) >= day))
  .sort((a, b) => ymd(b.fromDate).localeCompare(ymd(a.fromDate)))[0] || null;

// To Dairy periods are defined by their From Date: each one runs until the day
// before the next starts, the last one is open-ended — so they can never overlap.
const normalisePeriods = (list = []) => {
  const rows = list
    .filter(p => p && p.fromDate && Number(p.tsRate) >= 0 && p.tsRate !== '' && p.tsRate !== null)
    .map(p => ({ tsRate: Number(p.tsRate), fromDate: dayStart(p.fromDate), remarks: p.remarks || '' }))
    .sort((a, b) => a.fromDate - b.fromDate);
  for (let i = 1; i < rows.length; i++) {
    if (ymd(rows[i].fromDate) === ymd(rows[i - 1].fromDate)) {
      throw new Error(`Two To Dairy TS rates start on the same date (${ymd(rows[i].fromDate)})`);
    }
  }
  return rows.map((p, i) => {
    const next = rows[i + 1];
    let toDate = null;
    if (next) { toDate = new Date(next.fromDate); toDate.setDate(toDate.getDate() - 1); }
    return { ...p, toDate };
  });
};

// ════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════
export const getUnionSaleSettings = async (req, res) => {
  try {
    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const saveUnionSaleSettings = async (req, res) => {
  try {
    const { fromDairy = {}, toDairy = {} } = req.body;
    const side = (s) => ({
      tsEnabled: !!s.tsEnabled,
      regionName: String(s.regionName || '').trim(),
      fromDate: s.fromDate ? dayStart(s.fromDate) : null
    });
    const update = {
      fromDairy: side(fromDairy),
      toDairy: { ...side(toDairy), tsRates: normalisePeriods(toDairy.tsRates) }
    };
    if (update.fromDairy.tsEnabled && !update.fromDairy.fromDate) {
      return res.status(400).json({ success: false, message: 'From Dairy: set the From Date for TS Rate Settings' });
    }
    if (update.toDairy.tsEnabled && !update.toDairy.fromDate) {
      return res.status(400).json({ success: false, message: 'To Dairy: set the From Date for TS Rate Settings' });
    }
    if (update.toDairy.tsEnabled && !update.toDairy.tsRates.length) {
      return res.status(400).json({ success: false, message: 'To Dairy: add at least one TS rate' });
    }
    if (req.user?._id) update.lastUpdatedBy = req.user._id;

    const settings = await UnionSaleSettings.findOneAndUpdate(
      { companyId: req.companyId },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: settings, message: 'Union Sales settings saved' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /union-sales/settings/to-dairy-rate?date=YYYY-MM-DD — for the slip entry form
export const getToDairyRate = async (req, res) => {
  try {
    const settings = await UnionSaleSettings.getOrCreate(req.companyId);
    const td = settings.toDairy || {};
    const day = req.query.date || ymd(new Date());
    const active = td.tsEnabled && td.fromDate && ymd(td.fromDate) <= day;
    const period = active ? periodOn(td.tsRates || [], day) : null;
    res.json({ success: true, data: { enabled: !!active, tsRate: period ? period.tsRate : null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ════════════════════════════════════════════════════════════════
//  QUALITY COMPARISON REPORT
// ════════════════════════════════════════════════════════════════
const figures = ({ qty, fatQty, snfQty, amount }, tsRate) => {
  const fat = qty ? fatQty / qty : 0;
  const snf = qty ? snfQty / qty : 0;
  const ts = fat + snf;
  const actualRate = qty ? amount / qty : 0;
  const rate = tsRate !== null && tsRate !== undefined ? (ts * tsRate) / 100 : actualRate;
  return {
    qty: r2(qty),
    fat: r2(fat),
    snf: r2(snf),
    ts: r2(ts),
    rate: r2(rate),
    amount: r2(rate * qty),
    rateSource: tsRate !== null && tsRate !== undefined ? 'TS' : 'Actual',
    tsRate: tsRate ?? null
  };
};

const add = (acc, g) => {
  acc.qty += g.qty || 0;
  acc.fatQty += g.fatQty || 0;
  acc.snfQty += g.snfQty || 0;
  acc.amount += g.amount || 0;
  return acc;
};
const zero = () => ({ qty: 0, fatQty: 0, snfQty: 0, amount: 0 });

export const getQualityComparison = async (req, res) => {
  try {
    const { fromDate, toDate, centerId } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }
    const companyId = req.companyId;
    const start = dayStart(fromDate);
    const end = dayEnd(toDate);

    const collMatch = { companyId: toObjectId(companyId), date: { $gte: start, $lte: end } };
    if (centerId) collMatch.collectionCenter = toObjectId(centerId);

    const [settings, centres, tsCharges, procGroups, slipGroups] = await Promise.all([
      UnionSaleSettings.getOrCreate(companyId),
      CollectionCenter.find({ companyId }).select('centerName centerType farmerNoCode').lean(),
      TSRateCharge.find({ companyId }).lean(),
      MilkCollection.aggregate([
        { $match: collMatch },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
              centre: '$collectionCenter'
            },
            qty: { $sum: '$qty' },
            fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
            snfQty: { $sum: { $multiply: ['$qty', { $ifNull: ['$snf', 0] }] } },
            amount: { $sum: '$amount' }
          }
        }
      ]),
      UnionSalesSlip.aggregate([
        { $match: { companyId: toObjectId(companyId), date: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
            qty: { $sum: '$qty' },
            fatQty: { $sum: { $multiply: ['$qty', '$fat'] } },
            snfQty: { $sum: { $multiply: ['$qty', '$snf'] } },
            amount: { $sum: '$amount' },
            slips: { $sum: 1 }
          }
        }
      ])
    ]);

    const fd = settings.fromDairy || {};
    const td = settings.toDairy || {};
    // TS rate per side for a day, or null when the TS rule doesn't apply
    const fromTsRate = (day) => {
      if (!fd.tsEnabled || !fd.fromDate || ymd(fd.fromDate) > day) return null;
      return periodOn(tsCharges, day)?.tsRate ?? null;
    };
    const toTsRate = (day) => {
      if (!td.tsEnabled || !td.fromDate || ymd(td.fromDate) > day) return null;
      return periodOn(td.tsRates || [], day)?.tsRate ?? null;
    };

    const centreById = Object.fromEntries(centres.map(c => [String(c._id), c]));
    const centreLabel = (c) => (c ? { centreCode: c.farmerNoCode || '', centreName: c.centerName } : { centreCode: '', centreName: 'Unassigned' });
    const headOffice = centres.find(c => c.centerType === 'Head Office');

    // ── Section 1: Procurement Data (per date + centre) ─────────
    const procByDay = {};
    const procurement = procGroups.map(g => {
      const day = g._id.day;
      add(procByDay[day] ||= zero(), g);
      return { date: day, ...centreLabel(centreById[String(g._id.centre)]), ...figures(g, fromTsRate(day)) };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.centreName.localeCompare(b.centreName));

    // ── Section 2: To Dairy (union slips, per date) ──────────────
    const slipByDay = Object.fromEntries(slipGroups.map(g => [g._id, g]));
    const toDairy = slipGroups.map(g => ({
      date: g._id,
      ...centreLabel(headOffice),
      slips: g.slips,
      ...figures(g, toTsRate(g._id))
    })).sort((a, b) => a.date.localeCompare(b.date));

    // ── Section 3: Comparison (per date) ─────────────────────────
    const days = [...new Set([...Object.keys(procByDay), ...Object.keys(slipByDay)])].sort();
    const comparison = days.map(day => {
      const actual = procByDay[day] ? figures(procByDay[day], fromTsRate(day)) : null;
      const union = slipByDay[day] ? figures(slipByDay[day], toTsRate(day)) : null;
      const diff = actual && union ? {
        qty: r2(union.qty - actual.qty),
        fat: r2(union.fat - actual.fat),
        snf: r2(union.snf - actual.snf),
        ts: r2(union.ts - actual.ts),
        rate: r2(union.rate - actual.rate),
        amount: r2(union.amount - actual.amount)
      } : null;
      return { date: day, actual, toDairy: union, diff };
    });

    // Period totals (qty-weighted), only over days present on both sides for the difference
    const procAll = Object.values(procByDay).reduce((a, g) => add(a, g), zero());
    const slipAll = slipGroups.reduce((a, g) => add(a, g), zero());
    const sumAmount = (rows) => rows.reduce((s, r) => s + r.amount, 0);
    const totalOf = (all, rows) => {
      const f = figures(all, null);
      // Average rate over the period = Σ(day rate × day qty) / Σ qty, so TS days are respected
      const amount = sumAmount(rows);
      return { ...f, rate: all.qty ? r2(amount / all.qty) : 0, amount: r2(amount) };
    };
    const actualDays = comparison.filter(c => c.actual).map(c => c.actual);
    const unionDays = comparison.filter(c => c.toDairy).map(c => c.toDairy);
    const totals = {
      actual: totalOf(procAll, actualDays),
      toDairy: totalOf(slipAll, unionDays)
    };
    // Comparison total: only days present on BOTH sides, so a day whose union slip
    // isn't entered yet doesn't show up as a false shortage
    const matched = comparison.filter(c => c.actual && c.toDairy);
    const matchedProc = matched.reduce((a, c) => add(a, procByDay[c.date]), zero());
    const matchedSlip = matched.reduce((a, c) => add(a, slipByDay[c.date]), zero());
    const cmpActual = totalOf(matchedProc, matched.map(c => c.actual));
    const cmpUnion = totalOf(matchedSlip, matched.map(c => c.toDairy));
    totals.comparison = {
      actual: cmpActual,
      toDairy: cmpUnion,
      diff: {
        qty: r2(cmpUnion.qty - cmpActual.qty),
        fat: r2(cmpUnion.fat - cmpActual.fat),
        snf: r2(cmpUnion.snf - cmpActual.snf),
        ts: r2(cmpUnion.ts - cmpActual.ts),
        rate: r2(cmpUnion.rate - cmpActual.rate),
        amount: r2(cmpUnion.amount - cmpActual.amount)
      },
      matchedDays: matched.length,
      unmatchedDays: comparison.length - matched.length
    };

    res.json({
      success: true,
      data: {
        procurement,
        toDairy,
        comparison,
        totals,
        settings: {
          fromDairy: { tsEnabled: !!fd.tsEnabled, regionName: fd.regionName || '', fromDate: fd.fromDate },
          toDairy: { tsEnabled: !!td.tsEnabled, regionName: td.regionName || '', fromDate: td.fromDate }
        },
        // Union slips are for the whole society; with one centre selected the comparison
        // is that centre's procurement against the whole-society slip
        singleCentre: !!centerId,
        centreName: centerId ? (centreById[String(centerId)]?.centerName || '') : 'All Centres'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
